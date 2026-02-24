import {combineDateTime, generateSlots} from '@/lib/booking';

export {combineDateTime, generateSlots};

export function toHHMM(value: string | null | undefined) {
  return String(value || '10:00').slice(0, 5);
}
