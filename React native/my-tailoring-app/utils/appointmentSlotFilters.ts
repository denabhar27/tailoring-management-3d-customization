const USER_ALLOWED_SLOT_TIMES = new Set([
  '08:30',
  '09:30',
  '10:30',
  '11:30',
  '12:30',
  '13:30',
  '14:30',
  '15:30',
  '16:30',
]);

const normalizeTimeSlot = (timeValue: unknown) => String(timeValue || '').trim().substring(0, 5);

export const isUserAllowedSlotTime = (timeValue: unknown) => USER_ALLOWED_SLOT_TIMES.has(normalizeTimeSlot(timeValue));

export const filterUserAllowedSlots = <T extends { time_slot?: unknown }>(slots: T[] | null | undefined): T[] => {
  return (Array.isArray(slots) ? slots : []).filter((slot) => isUserAllowedSlotTime(slot?.time_slot));
};