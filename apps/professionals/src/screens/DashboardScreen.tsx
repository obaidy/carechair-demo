import {useCallback, useMemo, useState} from 'react';
import {Pressable, ScrollView, Text, View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {Ionicons} from '@expo/vector-icons';
import {format} from 'date-fns';
import {useFocusEffect} from '@react-navigation/native';
import {Button, Card, Sheet, StatCard} from '../components';
import {useTheme} from '../theme/provider';
import {useI18n} from '../i18n/provider';
import {useDashboardSummary, useEvents} from '../api/hooks';
import {useAuthStore} from '../state/authStore';
import {textDir} from '../utils/layout';
import {api} from '../api';

export function DashboardScreen({navigation}: any) {
  const {colors, spacing, typography, radius} = useTheme();
  const {t, isRTL} = useI18n();
  const [quickOpen, setQuickOpen] = useState(false);
  const context = useAuthStore((state) => state.context);
  const setContext = useAuthStore((state) => state.setContext);

  const todayIso = useMemo(() => new Date().toISOString(), []);
  const summaryQuery = useDashboardSummary(todayIso);
  const eventsQuery = useEvents(10);

  useFocusEffect(
    useCallback(() => {
      void summaryQuery.refetch();
      void eventsQuery.refetch();
      void api.owner.getContext().then((next) => {
        setContext(next);
      }).catch(() => {});
      return () => {};
    }, [eventsQuery, setContext, summaryQuery])
  );

  const status = context?.salon?.status || 'DRAFT';

  const statusLabel =
    status === 'ACTIVE'
      ? t('statusActive')
      : status === 'PENDING_REVIEW'
        ? t('statusPending')
        : status === 'SUSPENDED'
          ? t('statusSuspended')
          : t('statusDraft');

  const bannerText = status === 'PENDING_REVIEW' ? t('pendingReviewBanner') : status === 'SUSPENDED' ? t('suspendedBanner') : '';
  const isActive = status === 'ACTIVE';

  return (
    <SafeAreaView style={{flex: 1, backgroundColor: colors.background}}>
      <ScrollView contentContainerStyle={{padding: spacing.lg, gap: spacing.md, paddingBottom: 110}}>
        <View style={{gap: 4}}>
          <Text style={[typography.h2, {color: colors.text}, textDir(isRTL)]}>{t('dashboard')}</Text>
          <Text style={[typography.bodySm, {color: colors.textMuted}, textDir(isRTL)]}>{t('dashboardWelcome')}</Text>
        </View>

        <Card style={{gap: spacing.xs}}>
          <Text style={[typography.caption, {color: colors.textMuted}, textDir(isRTL)]}>{isRTL ? 'حالة الصالون' : 'Salon status'}</Text>
          <View
            style={{
              alignSelf: isRTL ? 'flex-end' : 'flex-start',
              borderRadius: radius.pill,
              paddingHorizontal: 10,
              paddingVertical: 6,
              backgroundColor: status === 'ACTIVE' ? colors.primarySoft : colors.surfaceSoft,
              borderWidth: 1,
              borderColor: status === 'ACTIVE' ? colors.primary : colors.border
            }}
          >
            <Text style={[typography.bodySm, {fontWeight: '700', color: status === 'ACTIVE' ? colors.primary : colors.textMuted}]}>{statusLabel}</Text>
          </View>
          {bannerText ? <Text style={[typography.bodySm, {color: colors.textMuted}, textDir(isRTL)]}>{bannerText}</Text> : null}
          {!isActive ? (
            <Button
              title={status === 'DRAFT' ? t('requestActivation') : isRTL ? 'تحديث بيانات التفعيل' : 'Update activation details'}
              variant="secondary"
              onPress={() => navigation.navigate('MoreTab')}
            />
          ) : context?.salon?.publicBookingUrl ? (
            <Text style={[typography.bodySm, {color: colors.primary}, textDir(isRTL)]}>
              {t('publishLink')}: {context.salon.publicBookingUrl}
            </Text>
          ) : null}
        </Card>

        <View style={{flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap'}}>
          <StatCard label={t('bookings')} value={summaryQuery.data?.bookingsCount ?? '-'} />
          <StatCard label={t('revenue')} value={summaryQuery.data ? `$${summaryQuery.data.revenue}` : '-'} />
          <StatCard label={t('noShows')} value={summaryQuery.data?.noShows ?? '-'} />
          <StatCard label={t('availableSlots')} value={summaryQuery.data?.availableSlots ?? '-'} />
        </View>

        <Card style={{gap: spacing.xs}}>
          <Text style={[typography.caption, {color: colors.textMuted}, textDir(isRTL)]}>{t('nextAppointment')}</Text>
          {summaryQuery.data?.nextAppointment ? (
            <View style={{gap: 4}}>
              <Text style={[typography.h3, {color: colors.text}, textDir(isRTL)]}>{summaryQuery.data.nextAppointment.clientName}</Text>
              <Text style={[typography.bodySm, {color: colors.textMuted}, textDir(isRTL)]}>
                {format(new Date(summaryQuery.data.nextAppointment.startAt), 'PPpp')}
              </Text>
            </View>
          ) : (
            <Text style={[typography.bodySm, {color: colors.textMuted}, textDir(isRTL)]}>{t('noData')}</Text>
          )}
        </Card>

        <Card style={{gap: spacing.sm}}>
          <Text style={[typography.h3, {color: colors.text}, textDir(isRTL)]}>{t('notifications')}</Text>
          {(eventsQuery.data || []).map((event) => (
            <View key={event.id} style={{paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border, gap: 2}}>
              <Text style={[typography.body, {color: colors.text}, textDir(isRTL)]}>{event.title}</Text>
              <Text style={[typography.bodySm, {color: colors.textMuted}, textDir(isRTL)]}>{event.description}</Text>
            </View>
          ))}
          {!eventsQuery.data?.length ? <Text style={[typography.bodySm, {color: colors.textMuted}, textDir(isRTL)]}>{t('noData')}</Text> : null}
        </Card>
      </ScrollView>

      <Pressable
        onPress={() => setQuickOpen(true)}
        style={{
          position: 'absolute',
          right: 22,
          bottom: 24,
          width: 58,
          height: 58,
          borderRadius: 29,
          backgroundColor: colors.primary,
          alignItems: 'center',
          justifyContent: 'center',
          shadowColor: colors.shadow,
          shadowOpacity: 0.25,
          shadowRadius: 10,
          shadowOffset: {width: 0, height: 5},
          elevation: 4
        }}
      >
        <Ionicons name="add" size={28} color="#fff" />
      </Pressable>

      <Sheet visible={quickOpen} onClose={() => setQuickOpen(false)}>
        <Text style={[typography.h3, {color: colors.text}, textDir(isRTL)]}>{t('quickActions')}</Text>
        <View style={{gap: spacing.sm}}>
          <ActionRow label={t('addBooking')} icon="calendar-outline" onPress={() => { setQuickOpen(false); navigation.navigate('CalendarTab'); }} />
          <ActionRow label={t('addWalkIn')} icon="person-add-outline" onPress={() => setQuickOpen(false)} />
          <ActionRow label={t('blockTime')} icon="remove-circle-outline" onPress={() => { setQuickOpen(false); navigation.navigate('CalendarTab'); }} />
          <ActionRow label={t('messageClient')} icon="chatbubbles-outline" onPress={() => setQuickOpen(false)} />
        </View>
      </Sheet>
    </SafeAreaView>
  );
}

function ActionRow({label, icon, onPress}: {label: string; icon: keyof typeof Ionicons.glyphMap; onPress: () => void}) {
  const {colors, spacing, typography, radius} = useTheme();

  return (
    <Pressable
      onPress={onPress}
      style={{
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: radius.md,
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.sm,
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm
      }}
    >
      <Ionicons name={icon} size={18} color={colors.textMuted} />
      <Text style={[typography.body, {color: colors.text}]}>{label}</Text>
    </Pressable>
  );
}
