import {useState} from 'react';
import {ScrollView, Text, View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {Controller, useForm} from 'react-hook-form';
import {z} from 'zod';
import {zodResolver} from '@hookform/resolvers/zod';
import * as Location from 'expo-location';
import {Button, Card, Input} from '../../components';
import {useTheme} from '../../theme/provider';
import {useI18n} from '../../i18n/provider';
import {textDir} from '../../utils/layout';
import {getOwnerContextBySalonIdV2, listActiveMembershipsV2, requestSalonActivationV2} from '../../api/invites';
import {persistActiveSalonId} from '../../auth/session';
import {useAuthStore} from '../../state/authStore';

const schema = z.object({
  city: z.string().optional(),
  area: z.string().optional(),
  addressMode: z.enum(['LOCATION', 'MANUAL']),
  addressText: z.string().optional(),
  locationLabel: z.string().optional(),
  storefrontPhotoUrl: z.string().optional()
});

type FormValues = z.infer<typeof schema>;

export function ActivationRequestScreen({route}: any) {
  const {colors, spacing, typography} = useTheme();
  const {isRTL} = useI18n();
  const salonId = String(route?.params?.salonId || '').trim();

  const setMemberships = useAuthStore((state) => state.setMemberships);
  const setActiveSalonId = useAuthStore((state) => state.setActiveSalonId);
  const setContext = useAuthStore((state) => state.setContext);

  const [submitError, setSubmitError] = useState('');
  const [saving, setSaving] = useState(false);
  const [geo, setGeo] = useState<{lat: number; lng: number; accuracy?: number} | null>(null);

  const {control, handleSubmit} = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      city: '',
      area: '',
      addressMode: 'MANUAL',
      addressText: '',
      locationLabel: '',
      storefrontPhotoUrl: ''
    }
  });

  async function finishAndEnterApp() {
    const memberships = await listActiveMembershipsV2();
    setMemberships(memberships);
    if (salonId) {
      await persistActiveSalonId(salonId);
      setActiveSalonId(salonId);
      const context = await getOwnerContextBySalonIdV2(salonId);
      setContext(context);
    }
  }

  async function onSubmit(values: FormValues) {
    if (!salonId) return;
    if (values.addressMode === 'MANUAL' && !String(values.addressText || '').trim()) {
      setSubmitError(isRTL ? 'يرجى إدخال العنوان اليدوي.' : 'Please enter manual address.');
      return;
    }
    if (values.addressMode === 'LOCATION' && !geo) {
      setSubmitError(isRTL ? 'يرجى تحديد الموقع الحالي أولاً.' : 'Please fetch current location first.');
      return;
    }
    setSubmitError('');
    setSaving(true);
    try {
      await requestSalonActivationV2(salonId, {
        city: values.city || undefined,
        area: values.area || undefined,
        addressMode: values.addressMode,
        addressText: values.addressMode === 'MANUAL' ? values.addressText || undefined : undefined,
        locationLat: values.addressMode === 'LOCATION' ? geo?.lat : undefined,
        locationLng: values.addressMode === 'LOCATION' ? geo?.lng : undefined,
        locationAccuracyM: values.addressMode === 'LOCATION' ? geo?.accuracy : undefined,
        locationLabel: values.locationLabel || undefined,
        storefrontPhotoUrl: values.storefrontPhotoUrl || undefined
      });
      await finishAndEnterApp();
    } catch (error: any) {
      setSubmitError(String(error?.message || (isRTL ? 'فشل إرسال طلب التفعيل.' : 'Failed to request activation.')));
    } finally {
      setSaving(false);
    }
  }

  async function onSkip() {
    setSubmitError('');
    setSaving(true);
    try {
      await finishAndEnterApp();
    } finally {
      setSaving(false);
    }
  }

  async function useCurrentLocation() {
    setSubmitError('');
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== 'granted') {
        setSubmitError(isRTL ? 'تم رفض إذن الموقع.' : 'Location permission denied.');
        return;
      }
      const pos = await Location.getCurrentPositionAsync({accuracy: Location.Accuracy.High});
      setGeo({
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        accuracy: pos.coords.accuracy ?? undefined
      });
    } catch (error: any) {
      setSubmitError(String(error?.message || (isRTL ? 'تعذر قراءة الموقع.' : 'Failed to read location.')));
    }
  }

  return (
    <SafeAreaView style={{flex: 1, backgroundColor: colors.background}}>
      <ScrollView contentContainerStyle={{padding: spacing.lg, gap: spacing.lg, flexGrow: 1}}>
        <View style={{gap: spacing.xs}}>
          <Text style={[typography.h2, {color: colors.text}, textDir(isRTL)]}>{isRTL ? 'طلب التفعيل' : 'Activation request'}</Text>
          <Text style={[typography.bodySm, {color: colors.textMuted}, textDir(isRTL)]}>
            {isRTL
              ? 'أضف بيانات المتجر لإرسال الطلب. يمكنك التخطي والمتابعة كمسودة.'
              : 'Add storefront details to submit review request. You can skip and continue as draft.'}
          </Text>
        </View>

        <Card style={{gap: spacing.md}}>
          <Controller
            control={control}
            name="addressMode"
            render={({field: {value, onChange}}) => (
              <View style={{gap: spacing.xs}}>
                <Text style={[typography.bodySm, {color: colors.text}, textDir(isRTL)]}>{isRTL ? 'نمط العنوان' : 'Address mode'}</Text>
                <View style={{flexDirection: isRTL ? 'row-reverse' : 'row', gap: spacing.sm}}>
                  <Button title={isRTL ? 'يدوي' : 'Manual'} variant={value === 'MANUAL' ? 'primary' : 'secondary'} onPress={() => onChange('MANUAL')} />
                  <Button title={isRTL ? 'موقعي الحالي' : 'Current location'} variant={value === 'LOCATION' ? 'primary' : 'secondary'} onPress={() => onChange('LOCATION')} />
                </View>
              </View>
            )}
          />

          <View style={{flexDirection: isRTL ? 'row-reverse' : 'row', gap: spacing.sm}}>
            <View style={{flex: 1}}>
              <Controller
                control={control}
                name="city"
                render={({field: {value, onChange}}) => (
                  <Input
                    label={isRTL ? 'المدينة' : 'City'}
                    value={value || ''}
                    onChangeText={onChange}
                  />
                )}
              />
            </View>
            <View style={{flex: 1}}>
              <Controller
                control={control}
                name="area"
                render={({field: {value, onChange}}) => (
                  <Input
                    label={isRTL ? 'المنطقة' : 'Area'}
                    value={value || ''}
                    onChangeText={onChange}
                  />
                )}
              />
            </View>
          </View>

          <Controller
            control={control}
            name="addressText"
            render={({field: {value, onChange}}) => (
              <Input
                label={isRTL ? 'العنوان اليدوي' : 'Manual address'}
                value={value || ''}
                onChangeText={onChange}
              />
            )}
          />

          <Controller
            control={control}
            name="locationLabel"
            render={({field: {value, onChange}, fieldState: {error}}) => (
              <Input
                label={isRTL ? 'وصف الموقع' : 'Location label'}
                value={value || ''}
                onChangeText={onChange}
                error={error ? (isRTL ? 'مطلوب' : 'Required') : undefined}
              />
            )}
          />

          <Button title={isRTL ? 'استخدام موقعي الحالي' : 'Use my current location'} variant="secondary" onPress={useCurrentLocation} />
          {geo ? (
            <Text style={[typography.bodySm, {color: colors.textMuted}, textDir(isRTL)]}>
              {isRTL ? 'الموقع المحدد' : 'Selected location'}: {geo.lat.toFixed(6)}, {geo.lng.toFixed(6)}
            </Text>
          ) : null}

          <Controller
            control={control}
            name="storefrontPhotoUrl"
            render={({field: {value, onChange}}) => (
              <Input label={isRTL ? 'رابط صورة الواجهة (اختياري)' : 'Storefront photo URL (optional)'} value={value || ''} onChangeText={onChange} />
            )}
          />

          {submitError ? <Text style={[typography.bodySm, {color: colors.danger}, textDir(isRTL)]}>{submitError}</Text> : null}

          <Button title={isRTL ? 'إرسال طلب التفعيل' : 'Request activation'} onPress={handleSubmit(onSubmit)} loading={saving} />
          <Button title={isRTL ? 'متابعة كمسودة' : 'Continue as draft'} variant="secondary" onPress={onSkip} loading={saving} />
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}
