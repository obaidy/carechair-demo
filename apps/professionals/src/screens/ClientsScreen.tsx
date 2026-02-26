import {useMemo, useState} from 'react';
import {FlatList, Pressable, Text, useWindowDimensions, View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {Controller, useForm} from 'react-hook-form';
import {z} from 'zod';
import {zodResolver} from '@hookform/resolvers/zod';
import {Button, Card, EmptyState, Input, Sheet} from '../components';
import {useTheme} from '../theme/provider';
import {useI18n} from '../i18n/provider';
import {textDir} from '../utils/layout';
import {useClientHistory, useClients, useCreateClient} from '../api/hooks';
import type {Client} from '../types/models';
import {format} from 'date-fns';

const schema = z.object({
  name: z.string().min(2),
  phone: z.string().min(8),
  notes: z.string().optional()
});

type FormValues = z.infer<typeof schema>;

export function ClientsScreen() {
  const {colors, spacing, typography, radius} = useTheme();
  const {t, isRTL} = useI18n();
  const {width} = useWindowDimensions();
  const isTablet = width >= 768;

  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Client | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  const clientsQuery = useClients(query);
  const historyQuery = useClientHistory(selected?.id);
  const createClient = useCreateClient();

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {name: '', phone: '', notes: ''}
  });

  async function onCreate(values: FormValues) {
    const created = await createClient.mutateAsync(values);
    setSelected(created);
    setAddOpen(false);
    form.reset();
  }

  const clientList = useMemo(() => clientsQuery.data || [], [clientsQuery.data]);

  const listPane = (
    <View style={{flex: 1, gap: spacing.sm}}>
      <Input value={query} onChangeText={setQuery} placeholder={t('clientsSearch')} />
      <FlatList
        data={clientList}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{gap: spacing.xs, paddingBottom: 120}}
        renderItem={({item}) => {
          const active = selected?.id === item.id;
          return (
            <Pressable
              onPress={() => setSelected(item)}
              style={{
                borderWidth: 1,
                borderColor: active ? colors.primary : colors.border,
                backgroundColor: active ? colors.primarySoft : colors.surface,
                borderRadius: radius.md,
                padding: spacing.sm,
                gap: 2
              }}
            >
              <Text style={[typography.body, {color: colors.text, fontWeight: '700'}, textDir(isRTL)]}>{item.name}</Text>
              <Text style={[typography.bodySm, {color: colors.textMuted}, textDir(isRTL)]}>{item.phone}</Text>
            </Pressable>
          );
        }}
        ListEmptyComponent={<EmptyState title={t('noData')} />}
      />
    </View>
  );

  const profilePane = selected ? (
    <Card style={{flex: 1, gap: spacing.sm}}>
      <Text style={[typography.h3, {color: colors.text}, textDir(isRTL)]}>{selected.name}</Text>
      <Text style={[typography.bodySm, {color: colors.textMuted}, textDir(isRTL)]}>{selected.phone}</Text>
      <Text style={[typography.bodySm, {color: colors.textMuted}, textDir(isRTL)]}>{selected.notes || t('noData')}</Text>
      <Text style={[typography.caption, {color: colors.textMuted}, textDir(isRTL)]}>{isRTL ? 'سجل المواعيد' : 'Appointment history'}</Text>
      {(historyQuery.data || []).map((booking) => (
        <View key={booking.id} style={{paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: colors.border}}>
          <Text style={[typography.bodySm, {color: colors.text}, textDir(isRTL)]}>{format(new Date(booking.startAt), 'PPP HH:mm')}</Text>
          <Text style={[typography.bodySm, {color: colors.textMuted}, textDir(isRTL)]}>{booking.status}</Text>
        </View>
      ))}
      {!historyQuery.data?.length ? <EmptyState title={t('noData')} /> : null}
    </Card>
  ) : (
    <Card style={{flex: 1}}>
      <EmptyState title={t('client')} subtitle={isRTL ? 'اختري عميلة من القائمة' : 'Select a client from the list'} />
    </Card>
  );

  return (
    <SafeAreaView style={{flex: 1, backgroundColor: colors.background}}>
      <View style={{flex: 1, padding: spacing.lg, gap: spacing.sm}}>
        <View style={{flexDirection: isRTL ? 'row-reverse' : 'row', justifyContent: 'space-between', alignItems: 'center'}}>
          <Text style={[typography.h2, {color: colors.text}, textDir(isRTL)]}>{t('clients')}</Text>
          <Button title={t('addClient')} onPress={() => setAddOpen(true)} />
        </View>

        {isTablet ? (
          <View style={{flex: 1, flexDirection: isRTL ? 'row-reverse' : 'row', gap: spacing.sm}}>
            <View style={{flex: 1}}>{listPane}</View>
            <View style={{flex: 1}}>{profilePane}</View>
          </View>
        ) : (
          <View style={{flex: 1}}>
            {listPane}
            <Sheet visible={Boolean(selected)} onClose={() => setSelected(null)}>
              {profilePane}
            </Sheet>
          </View>
        )}
      </View>

      <Sheet visible={addOpen} onClose={() => setAddOpen(false)}>
        <Text style={[typography.h3, {color: colors.text}, textDir(isRTL)]}>{t('addClient')}</Text>
        <View style={{gap: spacing.sm}}>
          <Controller
            control={form.control}
            name="name"
            render={({field: {value, onChange}, fieldState: {error}}) => (
              <Input label={t('name')} value={value} onChangeText={onChange} error={error ? t('requiredField') : undefined} />
            )}
          />
          <Controller
            control={form.control}
            name="phone"
            render={({field: {value, onChange}, fieldState: {error}}) => (
              <Input label={t('phoneLabel')} value={value} onChangeText={onChange} keyboardType="phone-pad" error={error ? t('requiredField') : undefined} />
            )}
          />
          <Controller control={form.control} name="notes" render={({field: {value, onChange}}) => <Input label={t('clientNotes')} value={value || ''} onChangeText={onChange} />} />

          <Button title={t('create')} onPress={form.handleSubmit(onCreate)} loading={createClient.isPending} />
        </View>
      </Sheet>
    </SafeAreaView>
  );
}
