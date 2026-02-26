import {KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, View} from 'react-native';
import {useTheme} from '../theme/provider';

type SheetProps = {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
};

export function Sheet({visible, onClose, children}: SheetProps) {
  const {colors, radius} = useTheme();

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
      <Pressable style={{flex: 1, backgroundColor: '#00000055', justifyContent: 'flex-end'}} onPress={onClose}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <Pressable
            onPress={(event) => event.stopPropagation()}
            style={{
              maxHeight: '88%',
              backgroundColor: colors.surface,
              borderTopLeftRadius: radius.xl,
              borderTopRightRadius: radius.xl,
              borderWidth: 1,
              borderColor: colors.border,
              paddingHorizontal: 16,
              paddingTop: 12
            }}
          >
            <View style={{width: 46, height: 4, borderRadius: 999, backgroundColor: colors.border, alignSelf: 'center', marginBottom: 10}} />
            <ScrollView
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
              contentContainerStyle={{paddingBottom: 16, gap: 12}}
              showsVerticalScrollIndicator={false}
            >
              {children}
            </ScrollView>
          </Pressable>
        </KeyboardAvoidingView>
      </Pressable>
    </Modal>
  );
}
