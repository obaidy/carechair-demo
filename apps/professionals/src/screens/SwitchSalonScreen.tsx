import {useState} from 'react';
import {ScrollView, Text, View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {Button, Card} from '../components';
import {useTheme} from '../theme/provider';
import {useI18n} from '../i18n/provider';
import {textDir} from '../utils/layout';
import {getOwnerContextBySalonIdV2} from '../api/invites';
import {persistActiveSalonId} from '../auth/session';
import {useAuthStore} from '../state/authStore';

export function SwitchSalonScreen({navigation}: any) {
  const {colors, spacing, typography} = useTheme();
  const {isRTL} = useI18n();
  const memberships = useAuthStore((state) => state.memberships);
  const activeSalonId = useAuthStore((state) => state.activeSalonId);
  const setActiveSalonId = useAuthStore((state) => state.setActiveSalonId);
  const setContext = useAuthStore((state) => state.setContext);
  const [loadingSalonId, setLoadingSalonId] = useState<string | null>(null);
  const [error, setError] = useState('');

  async function onSelect(salonId: string) {
    setError('');
    setLoadingSalonId(salonId);
    try {
      await persistActiveSalonId(salonId);
      setActiveSalonId(salonId);
      const context = await getOwnerContextBySalonIdV2(salonId);
      setContext(context);
      if (navigation?.canGoBack?.()) navigation.goBack();
    } catch (err: any) {
      setError(String(err?.message || (isRTL ? 'تعذر التحويل.' : 'Failed to switch salon.')));
    } finally {
      setLoadingSalonId(null);
    }
  }

  return (
    <SafeAreaView style={{flex: 1, backgroundColor: colors.background}}>
      <ScrollView contentContainerStyle={{padding: spacing.lg, gap: spacing.md}}>
        <Text style={[typography.h2, {color: colors.text}, textDir(isRTL)]}>{isRTL ? 'اختيار الصالون' : 'Switch salon'}</Text>

        {!memberships.length ? (
          <Card>
            <Text style={[typography.bodySm, {color: colors.textMuted}, textDir(isRTL)]}>
              {isRTL ? 'لا توجد عضويات نشطة حالياً.' : 'No active salon memberships.'}
            </Text>
          </Card>
        ) : null}

        {memberships.map((membership) => {
          const selected = membership.salonId === activeSalonId;
          return (
            <Card key={`${membership.salonId}:${membership.role}`} style={{gap: spacing.xs}}>
              <Text style={[typography.body, {color: colors.text}, textDir(isRTL)]}>{membership.salonName || membership.salonId}</Text>
              {membership.salonSlug ? (
                <Text style={[typography.caption, {color: colors.textMuted}, textDir(isRTL)]}>/{membership.salonSlug}</Text>
              ) : null}
              <Text style={[typography.caption, {color: colors.textMuted}, textDir(isRTL)]}>
                {isRTL ? 'الدور' : 'Role'}: {membership.role}
              </Text>
              <Button
                title={selected ? (isRTL ? 'محدد حالياً' : 'Selected') : isRTL ? 'اختيار' : 'Select'}
                variant={selected ? 'secondary' : 'primary'}
                disabled={selected}
                loading={loadingSalonId === membership.salonId}
                onPress={() => onSelect(membership.salonId)}
              />
            </Card>
          );
        })}

        {error ? <Text style={[typography.bodySm, {color: colors.danger}, textDir(isRTL)]}>{error}</Text> : null}
      </ScrollView>
    </SafeAreaView>
  );
}
