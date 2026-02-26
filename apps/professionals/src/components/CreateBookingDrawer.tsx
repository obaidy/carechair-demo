import {Pressable, ScrollView, Text, TextInput, View} from 'react-native';
import type {LocaleCode} from '../i18n';
import type {CreateDraft, ServiceRow, StaffRow} from '../types';
import {styles} from '../styles';
import {formatTime} from '../utils';

type CreateBookingDrawerProps = {
  open: boolean;
  draft: CreateDraft | null;
  activeServices: ServiceRow[];
  staff: StaffRow[];
  staffColorById: Record<string, string>;
  rtl: boolean;
  locale: LocaleCode;
  savingCreate: boolean;
  t: (key: string, params?: Record<string, string | number>) => string;
  isEmployeeEligibleForService: (employeeId: string, serviceId: string) => boolean;
  setDraft: (updater: (prev: CreateDraft | null) => CreateDraft | null) => void;
  onSave: () => void;
  onClose: () => void;
};

export function CreateBookingDrawer(props: CreateBookingDrawerProps) {
  const {
    open,
    draft,
    activeServices,
    staff,
    staffColorById,
    rtl,
    locale,
    savingCreate,
    t,
    isEmployeeEligibleForService,
    setDraft,
    onSave,
    onClose
  } = props;

  if (!open || !draft) return null;

  return (
    <View style={styles.drawerBackdrop}>
      <View style={styles.drawerCard}>
        <Text style={[styles.panelTitle, rtl && styles.textRtl]}>{t('createBooking')}</Text>

        <Text style={[styles.inputLabel, rtl && styles.textRtl]}>{t('service')}</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.staffScrollerContent}>
          {activeServices.map((service) => (
            <Pressable
              key={service.id}
              style={[styles.serviceChip, draft.serviceId === String(service.id) && styles.serviceChipActive]}
              onPress={() => setDraft((prev) => (prev ? {...prev, serviceId: String(service.id)} : prev))}
            >
              <Text style={[styles.serviceChipText, draft.serviceId === String(service.id) && styles.serviceChipTextActive]}>{service.name}</Text>
            </Pressable>
          ))}
        </ScrollView>

        <Text style={[styles.inputLabel, rtl && styles.textRtl]}>{t('employee')}</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.staffScrollerContent}>
          {staff
            .filter((member) => isEmployeeEligibleForService(String(member.id), String(draft.serviceId || '')))
            .map((member) => (
              <Pressable
                key={member.id}
                style={[styles.staffChip, draft.employeeId === String(member.id) && styles.staffChipActive]}
                onPress={() => setDraft((prev) => (prev ? {...prev, employeeId: String(member.id)} : prev))}
              >
                <View style={[styles.avatarDot, {backgroundColor: staffColorById[String(member.id)] || '#64748b'}]} />
                <Text style={[styles.staffChipText, draft.employeeId === String(member.id) && styles.staffChipTextActive]}>{member.name}</Text>
              </Pressable>
            ))}
        </ScrollView>

        <Text style={[styles.inputLabel, rtl && styles.textRtl]}>{t('customerName')}</Text>
        <TextInput style={styles.input} value={draft.customerName} onChangeText={(value) => setDraft((prev) => (prev ? {...prev, customerName: value} : prev))} />

        <Text style={[styles.inputLabel, rtl && styles.textRtl]}>{t('customerPhone')}</Text>
        <TextInput
          style={styles.input}
          keyboardType="phone-pad"
          value={draft.customerPhone}
          onChangeText={(value) => setDraft((prev) => (prev ? {...prev, customerPhone: value} : prev))}
        />

        <View style={[styles.rowWrap, rtl && styles.rowRtl]}>
          <Pressable style={styles.secondaryBtnSm} onPress={() => setDraft((prev) => (prev ? {...prev, start: new Date(prev.start.getTime() - 30 * 60000)} : prev))}>
            <Text style={styles.secondaryBtnText}>-30</Text>
          </Pressable>
          <Text style={[styles.helperText, rtl && styles.textRtl]}>
            {t('startTime')}: {formatTime(draft.start, locale)}
          </Text>
          <Pressable style={styles.secondaryBtnSm} onPress={() => setDraft((prev) => (prev ? {...prev, start: new Date(prev.start.getTime() + 30 * 60000)} : prev))}>
            <Text style={styles.secondaryBtnText}>+30</Text>
          </Pressable>
        </View>

        <View style={[styles.rowWrap, rtl && styles.rowRtl]}>
          <Text style={[styles.helperText, rtl && styles.textRtl]}>
            {t('duration')}: {draft.duration} {t('minutes')}
          </Text>
        </View>

        <View style={[styles.rowWrap, rtl && styles.rowRtl]}>
          <Pressable style={[styles.primaryBtn, savingCreate && styles.disabledBtn]} onPress={onSave} disabled={savingCreate}>
            <Text style={styles.primaryBtnText}>{savingCreate ? t('saving') : t('save')}</Text>
          </Pressable>
          <Pressable style={styles.secondaryBtn} onPress={onClose}>
            <Text style={styles.secondaryBtnText}>{t('cancel')}</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}
