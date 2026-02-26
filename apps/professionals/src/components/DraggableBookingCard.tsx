import {useMemo, useRef} from 'react';
import {Animated, PanResponder, Text} from 'react-native';
import type {LocaleCode} from '../i18n';
import type {BookingView} from '../types';
import {formatTime} from '../utils';
import {PALETTE} from '../constants';
import {styles} from '../styles';

type DraggableCardProps = {
  booking: BookingView;
  top: number;
  height: number;
  showStaff: boolean;
  locale: LocaleCode;
  isRtl: boolean;
  onDrop: (deltaY: number) => void;
  onDragStateChange: (active: boolean) => void;
};

export function DraggableBookingCard({booking, top, height, showStaff, locale, isRtl, onDrop, onDragStateChange}: DraggableCardProps) {
  const panY = useRef(new Animated.Value(0)).current;

  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_evt, gesture) => Math.abs(gesture.dy) > 8,
        onPanResponderGrant: () => {
          onDragStateChange(true);
        },
        onPanResponderMove: (_evt, gesture) => {
          panY.setValue(gesture.dy);
        },
        onPanResponderRelease: (_evt, gesture) => {
          onDragStateChange(false);
          onDrop(gesture.dy);
          Animated.spring(panY, {
            toValue: 0,
            useNativeDriver: true,
            bounciness: 6
          }).start();
        },
        onPanResponderTerminate: () => {
          onDragStateChange(false);
          Animated.spring(panY, {
            toValue: 0,
            useNativeDriver: true,
            bounciness: 6
          }).start();
        }
      }),
    [onDragStateChange, onDrop, panY]
  );

  return (
    <Animated.View
      style={[
        styles.bookingCard,
        {
          top,
          height,
          borderLeftColor: booking.color,
          transform: [{translateY: panY}]
        }
      ]}
      {...responder.panHandlers}
    >
      <Text style={[styles.bookingCustomer, isRtl && styles.textRtl]} numberOfLines={1}>
        {booking.customerName || '-'}
      </Text>
      <Text style={[styles.bookingService, isRtl && styles.textRtl]} numberOfLines={1}>
        {booking.serviceName}
      </Text>
      <Text style={[styles.bookingMeta, isRtl && styles.textRtl]} numberOfLines={1}>
        {formatTime(booking.startsAt, locale)} - {formatTime(booking.endsAt, locale)}
      </Text>
      {showStaff ? (
        <Text style={[styles.bookingMeta, {color: PALETTE.ink500}, isRtl && styles.textRtl]} numberOfLines={1}>
          {booking.staffName}
        </Text>
      ) : null}
    </Animated.View>
  );
}
