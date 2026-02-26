import {Text, View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {Button, Card} from '../../components';
import {useTheme} from '../../theme/provider';
import {useI18n} from '../../i18n/provider';
import {textDir} from '../../utils/layout';

export function ChoosePathScreen({navigation}: any) {
  const {colors, spacing, typography} = useTheme();
  const {isRTL} = useI18n();

  return (
    <SafeAreaView style={{flex: 1, backgroundColor: colors.background}}>
      <View style={{flex: 1, padding: spacing.lg, gap: spacing.lg, justifyContent: 'center'}}>
        <View style={{gap: spacing.xs}}>
          <Text style={[typography.h1, {color: colors.text}, textDir(isRTL)]}>
            {isRTL ? 'ابدأ في دقيقة واحدة' : 'Start in one minute'}
          </Text>
          <Text style={[typography.body, {color: colors.textMuted}, textDir(isRTL)]}>
            {isRTL
              ? 'أنشئ صالون جديد أو انضم إلى صالون موجود عبر رابط أو كود دعوة.'
              : 'Create a new salon or join an existing one with an invite link/code.'}
          </Text>
        </View>

        <Card style={{gap: spacing.md}}>
          <Button title={isRTL ? 'إنشاء صالون جديد' : 'Create new salon'} onPress={() => navigation.navigate('CreateSalonWizard')} />
          <Button
            title={isRTL ? 'الانضمام عبر دعوة' : 'Join via invite'}
            variant="secondary"
            onPress={() => navigation.navigate('JoinByInvite')}
          />
        </Card>
      </View>
    </SafeAreaView>
  );
}
