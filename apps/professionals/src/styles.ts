import {StyleSheet} from 'react-native';
import {PALETTE, PIXELS_PER_MINUTE} from './constants';

export const styles = StyleSheet.create({
  flexOne: {
    flex: 1
  },
  root: {
    flex: 1,
    backgroundColor: PALETTE.bg
  },
  backgroundGradient: {
    ...StyleSheet.absoluteFillObject
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center'
  },
  screenContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    gap: 16
  },
  heroCard: {
    borderRadius: 22,
    backgroundColor: PALETTE.surface,
    borderWidth: 1,
    borderColor: '#d7e5f6',
    padding: 20,
    shadowColor: '#93a9c5',
    shadowOpacity: 0.18,
    shadowRadius: 20,
    shadowOffset: {width: 0, height: 10},
    elevation: 5
  },
  heroCardTablet: {
    maxWidth: 900,
    alignSelf: 'center',
    width: '100%'
  },
  card: {
    borderRadius: 22,
    backgroundColor: PALETTE.surface,
    borderWidth: 1,
    borderColor: PALETTE.line,
    padding: 18,
    gap: 12
  },
  cardTablet: {
    maxWidth: 720,
    alignSelf: 'center',
    width: '100%'
  },
  pendingCardTablet: {
    maxWidth: 760,
    alignSelf: 'center',
    width: '100%'
  },
  kicker: {
    fontSize: 12,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: '#4e6b8d',
    fontWeight: '700'
  },
  heroTitle: {
    marginTop: 8,
    color: PALETTE.ink900,
    fontSize: 26,
    lineHeight: 32,
    fontWeight: '800'
  },
  heroSubtitle: {
    marginTop: 10,
    color: PALETTE.ink700,
    fontSize: 15,
    lineHeight: 23
  },
  localeRow: {
    marginTop: 12,
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap'
  },
  localeChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: PALETTE.line,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#f8fbff'
  },
  localeChipActive: {
    borderColor: PALETTE.accent,
    backgroundColor: PALETTE.accentSoft
  },
  localeChipText: {
    color: PALETTE.ink500,
    fontWeight: '700',
    fontSize: 12
  },
  localeChipTextActive: {
    color: '#0d6158'
  },
  segmentRow: {
    flexDirection: 'row',
    backgroundColor: '#eef3fa',
    borderRadius: 12,
    padding: 4,
    gap: 4
  },
  segmentBtn: {
    flex: 1,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center'
  },
  segmentBtnActive: {
    backgroundColor: PALETTE.surface,
    shadowColor: '#afbdd1',
    shadowOpacity: 0.22,
    shadowRadius: 8,
    shadowOffset: {width: 0, height: 2},
    elevation: 1
  },
  segmentText: {
    color: PALETTE.ink500,
    fontWeight: '700'
  },
  segmentTextActive: {
    color: PALETTE.ink900
  },
  rowWrap: {
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap',
    alignItems: 'center'
  },
  rowRtl: {
    flexDirection: 'row-reverse'
  },
  roleChip: {
    borderWidth: 1,
    borderColor: PALETTE.line,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: '#f8fbff'
  },
  roleChipActive: {
    borderColor: PALETTE.accent,
    backgroundColor: PALETTE.accentSoft
  },
  roleText: {
    color: PALETTE.ink500,
    fontWeight: '700'
  },
  roleTextActive: {
    color: '#0d6158'
  },
  stackSm: {
    gap: 10
  },
  inputLabel: {
    color: PALETTE.ink700,
    fontWeight: '600',
    fontSize: 13
  },
  input: {
    borderWidth: 1,
    borderColor: PALETTE.line,
    borderRadius: 12,
    backgroundColor: PALETTE.surface,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: PALETTE.ink900,
    fontSize: 16
  },
  inputCol: {
    flex: 1,
    minWidth: 120
  },
  primaryBtn: {
    borderRadius: 12,
    backgroundColor: PALETTE.accent,
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center'
  },
  primaryBtnSm: {
    borderRadius: 10,
    backgroundColor: PALETTE.accent,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center'
  },
  primaryBtnText: {
    color: '#ffffff',
    fontWeight: '800',
    letterSpacing: 0.2
  },
  secondaryBtn: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: PALETTE.line,
    backgroundColor: '#f7fbff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center'
  },
  secondaryBtnSm: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: PALETTE.line,
    backgroundColor: '#f7fbff',
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center'
  },
  secondaryBtnText: {
    color: PALETTE.ink700,
    fontWeight: '700'
  },
  disabledBtn: {
    opacity: 0.6
  },
  successText: {
    color: PALETTE.success,
    fontWeight: '600'
  },
  errorText: {
    color: PALETTE.danger,
    fontWeight: '600'
  },
  helperText: {
    color: PALETTE.ink500,
    fontSize: 13,
    lineHeight: 19
  },
  textRtl: {
    textAlign: 'right',
    writingDirection: 'rtl'
  },
  pendingTitle: {
    color: PALETTE.ink900,
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '800',
    marginTop: 6
  },
  pendingSubtitle: {
    color: PALETTE.ink700,
    fontSize: 15,
    lineHeight: 23,
    marginTop: 8,
    marginBottom: 8
  },
  dashboardRoot: {
    flex: 1,
    paddingBottom: 16
  },
  dashboardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
    gap: 10
  },
  dashboardTitle: {
    color: PALETTE.ink900,
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '800',
    marginTop: 4
  },
  dashboardSubtitle: {
    color: PALETTE.ink500,
    fontSize: 14,
    marginTop: 4,
    fontWeight: '600'
  },
  dayNav: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10
  },
  kpiRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 10
  },
  kpiCard: {
    flexGrow: 1,
    minWidth: 110,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: PALETTE.line,
    backgroundColor: PALETTE.surface,
    padding: 12
  },
  kpiLabel: {
    color: PALETTE.ink500,
    fontSize: 12,
    fontWeight: '600'
  },
  kpiValue: {
    color: PALETTE.ink900,
    fontSize: 20,
    fontWeight: '800',
    marginTop: 4
  },
  staffScroller: {
    marginBottom: 8
  },
  staffScrollerContent: {
    gap: 8,
    paddingRight: 12
  },
  staffChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: PALETTE.line,
    backgroundColor: PALETTE.surface,
    paddingVertical: 8,
    paddingHorizontal: 12
  },
  staffChipActive: {
    borderColor: PALETTE.accent,
    backgroundColor: PALETTE.accentSoft
  },
  staffChipText: {
    color: PALETTE.ink700,
    fontWeight: '600'
  },
  staffChipTextActive: {
    color: '#0d6158',
    fontWeight: '700'
  },
  avatarDot: {
    width: 10,
    height: 10,
    borderRadius: 999
  },
  serviceChip: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: PALETTE.line,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: PALETTE.surface,
    maxWidth: 220
  },
  serviceChipActive: {
    borderColor: PALETTE.accent,
    backgroundColor: PALETTE.accentSoft
  },
  serviceChipText: {
    color: PALETTE.ink700,
    fontSize: 12,
    fontWeight: '600'
  },
  serviceChipTextActive: {
    color: '#0d6158',
    fontWeight: '700'
  },
  calendarCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: PALETTE.line,
    backgroundColor: PALETTE.surface,
    padding: 12,
    marginTop: 8,
    gap: 10,
    flex: 1
  },
  calendarTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  timelineScroll: {
    maxHeight: 520,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: PALETTE.line,
    backgroundColor: PALETTE.calendarBg
  },
  timelineWrap: {
    flexDirection: 'row',
    minHeight: 200
  },
  timelineLabels: {
    width: 58,
    backgroundColor: '#f1f6fd',
    borderRightWidth: 1,
    borderColor: PALETTE.line
  },
  hourLabelRow: {
    height: 60 * PIXELS_PER_MINUTE,
    justifyContent: 'flex-start',
    paddingTop: 2,
    alignItems: 'center'
  },
  hourLabel: {
    fontSize: 11,
    color: PALETTE.ink500,
    fontWeight: '600'
  },
  timelineGrid: {
    flex: 1,
    position: 'relative'
  },
  timelineGridCanvas: {
    position: 'relative'
  },
  hourLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: '#dae6f5'
  },
  timelineSlot: {
    position: 'absolute',
    left: 0,
    right: 0,
    borderBottomWidth: 1,
    borderBottomColor: '#edf2f9',
    justifyContent: 'center',
    alignItems: 'center'
  },
  timelineSlotBlocked: {
    backgroundColor: 'rgba(107, 122, 146, 0.14)'
  },
  slotBlockedX: {
    color: '#8fa1bb',
    fontSize: 12,
    fontWeight: '700'
  },
  bookingCard: {
    position: 'absolute',
    left: 8,
    right: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#d7e2f1',
    borderLeftWidth: 5,
    backgroundColor: '#ffffff',
    paddingHorizontal: 8,
    paddingVertical: 6,
    shadowColor: '#8ea4c4',
    shadowOpacity: 0.16,
    shadowRadius: 8,
    shadowOffset: {width: 0, height: 3},
    elevation: 2
  },
  bookingCustomer: {
    color: PALETTE.ink900,
    fontWeight: '700',
    fontSize: 12
  },
  bookingService: {
    color: PALETTE.ink700,
    fontSize: 11,
    marginTop: 2
  },
  bookingMeta: {
    color: PALETTE.ink500,
    fontSize: 10,
    marginTop: 2
  },
  moveBar: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#cde8e3',
    backgroundColor: '#edf8f6',
    padding: 10,
    gap: 8
  },
  moveBarText: {
    color: '#0f5c53',
    fontWeight: '600',
    fontSize: 12
  },
  panelCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: PALETTE.line,
    backgroundColor: PALETTE.surface,
    padding: 14,
    marginTop: 8
  },
  panelTitle: {
    color: PALETTE.ink900,
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 10
  },
  agendaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#eef2f8'
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 999
  },
  agendaTextWrap: {
    flex: 1
  },
  agendaCustomer: {
    color: PALETTE.ink900,
    fontWeight: '700'
  },
  agendaMeta: {
    color: PALETTE.ink500,
    marginTop: 1,
    fontSize: 12
  },
  agendaTime: {
    color: PALETTE.ink700,
    fontWeight: '700',
    fontSize: 12
  },
  teamRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#eef2f8'
  },
  avatarBadge: {
    width: 32,
    height: 32,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center'
  },
  avatarBadgeText: {
    color: '#fff',
    fontWeight: '800'
  },
  drawerBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 23, 42, 0.35)',
    justifyContent: 'flex-end'
  },
  drawerCard: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    borderColor: PALETTE.line,
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 20,
    gap: 10,
    maxHeight: '82%'
  }
});
