
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Platform,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface DateTimePickerModalProps {
  visible: boolean;
  mode: 'date' | 'time' | 'datetime';
  value: Date;
  minimumDate?: Date;
  onConfirm: (date: Date) => void;
  onCancel: () => void;
}

const generateDays = (year: number, month: number) => {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  return Array.from({ length: daysInMonth }, (_, i) => i + 1);
};

const months = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const generateYears = () => {
  const currentYear = new Date().getFullYear();
  return Array.from({ length: 5 }, (_, i) => currentYear + i);
};

const generateHours = () => Array.from({ length: 12 }, (_, i) => i + 1);
const generateMinutes = () => Array.from({ length: 60 }, (_, i) => i);

export default function DateTimePickerModal({
  visible,
  mode,
  value,
  minimumDate,
  onConfirm,
  onCancel,
}: DateTimePickerModalProps) {
  const [selectedDate, setSelectedDate] = useState(value);
  const [selectedYear, setSelectedYear] = useState(value.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(value.getMonth());
  const [selectedDay, setSelectedDay] = useState(value.getDate());
  const [selectedHour, setSelectedHour] = useState(value.getHours() % 12 || 12);
  const [selectedMinute, setSelectedMinute] = useState(value.getMinutes());
  const [selectedAmPm, setSelectedAmPm] = useState(value.getHours() >= 12 ? 'PM' : 'AM');

  const handleConfirm = () => {
    let finalDate = new Date(selectedYear, selectedMonth, selectedDay);

    if (mode === 'time' || mode === 'datetime') {
      let hours = selectedHour;
      if (selectedAmPm === 'PM' && hours !== 12) hours += 12;
      if (selectedAmPm === 'AM' && hours === 12) hours = 0;
      finalDate.setHours(hours, selectedMinute);
    }

    onConfirm(finalDate);
  };

  const days = generateDays(selectedYear, selectedMonth);
  const years = generateYears();
  const hours = generateHours();
  const minutes = generateMinutes();

  const isDateDisabled = (year: number, month: number, day: number) => {
    if (!minimumDate) return false;
    const checkDate = new Date(year, month, day);
    const minDateOnly = new Date(minimumDate.getFullYear(), minimumDate.getMonth(), minimumDate.getDate());
    return checkDate < minDateOnly;
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.overlay}>
        <View style={styles.container}>
          <View style={styles.header}>
            <TouchableOpacity onPress={onCancel}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.title}>
              {mode === 'date' ? 'Select Date' : mode === 'time' ? 'Select Time' : 'Select Date & Time'}
            </Text>
            <TouchableOpacity onPress={handleConfirm}>
              <Text style={styles.confirmText}>Done</Text>
            </TouchableOpacity>
          </View>

          {(mode === 'date' || mode === 'datetime') && (
            <View style={styles.dateSection}>
              <Text style={styles.sectionLabel}>Date</Text>
              <View style={styles.pickerRow}>
                <ScrollView style={styles.pickerColumn} showsVerticalScrollIndicator={false}>
                  {months.map((month, index) => (
                    <TouchableOpacity
                      key={month}
                      style={[
                        styles.pickerItem,
                        selectedMonth === index && styles.pickerItemSelected,
                      ]}
                      onPress={() => setSelectedMonth(index)}
                    >
                      <Text style={[
                        styles.pickerItemText,
                        selectedMonth === index && styles.pickerItemTextSelected,
                      ]}>
                        {month}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
                <ScrollView style={styles.pickerColumnSmall} showsVerticalScrollIndicator={false}>
                  {days.map((day) => {
                    const disabled = isDateDisabled(selectedYear, selectedMonth, day);
                    return (
                      <TouchableOpacity
                        key={day}
                        style={[
                          styles.pickerItem,
                          selectedDay === day && styles.pickerItemSelected,
                          disabled && styles.pickerItemDisabled,
                        ]}
                        onPress={() => !disabled && setSelectedDay(day)}
                        disabled={disabled}
                      >
                        <Text style={[
                          styles.pickerItemText,
                          selectedDay === day && styles.pickerItemTextSelected,
                          disabled && styles.pickerItemTextDisabled,
                        ]}>
                          {day}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
                <ScrollView style={styles.pickerColumnSmall} showsVerticalScrollIndicator={false}>
                  {years.map((year) => (
                    <TouchableOpacity
                      key={year}
                      style={[
                        styles.pickerItem,
                        selectedYear === year && styles.pickerItemSelected,
                      ]}
                      onPress={() => setSelectedYear(year)}
                    >
                      <Text style={[
                        styles.pickerItemText,
                        selectedYear === year && styles.pickerItemTextSelected,
                      ]}>
                        {year}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            </View>
          )}

          {(mode === 'time' || mode === 'datetime') && (
            <View style={styles.timeSection}>
              <Text style={styles.sectionLabel}>Time</Text>
              <View style={styles.pickerRow}>
                <ScrollView style={styles.pickerColumnSmall} showsVerticalScrollIndicator={false}>
                  {hours.map((hour) => (
                    <TouchableOpacity
                      key={hour}
                      style={[
                        styles.pickerItem,
                        selectedHour === hour && styles.pickerItemSelected,
                      ]}
                      onPress={() => setSelectedHour(hour)}
                    >
                      <Text style={[
                        styles.pickerItemText,
                        selectedHour === hour && styles.pickerItemTextSelected,
                      ]}>
                        {hour}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                <Text style={styles.timeSeparator}>:</Text>
                <ScrollView style={styles.pickerColumnSmall} showsVerticalScrollIndicator={false}>
                  {minutes.map((minute) => (
                    <TouchableOpacity
                      key={minute}
                      style={[
                        styles.pickerItem,
                        selectedMinute === minute && styles.pickerItemSelected,
                      ]}
                      onPress={() => setSelectedMinute(minute)}
                    >
                      <Text style={[
                        styles.pickerItemText,
                        selectedMinute === minute && styles.pickerItemTextSelected,
                      ]}>
                        {minute.toString().padStart(2, '0')}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
                <View style={styles.amPmColumn}>
                  <TouchableOpacity
                    style={[
                      styles.amPmButton,
                      selectedAmPm === 'AM' && styles.amPmButtonSelected,
                    ]}
                    onPress={() => setSelectedAmPm('AM')}
                  >
                    <Text style={[
                      styles.amPmText,
                      selectedAmPm === 'AM' && styles.amPmTextSelected,
                    ]}>AM</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.amPmButton,
                      selectedAmPm === 'PM' && styles.amPmButtonSelected,
                    ]}
                    onPress={() => setSelectedAmPm('PM')}
                  >
                    <Text style={[
                      styles.amPmText,
                      selectedAmPm === 'PM' && styles.amPmTextSelected,
                    ]}>PM</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}
          <View style={styles.previewSection}>
            <Text style={styles.previewLabel}>Selected:</Text>
            <Text style={styles.previewText}>
              {(mode === 'date' || mode === 'datetime') &&
                `${months[selectedMonth]} ${selectedDay}, ${selectedYear}`}
              {mode === 'datetime' && ' at '}
              {(mode === 'time' || mode === 'datetime') &&
                `${selectedHour}:${selectedMinute.toString().padStart(2, '0')} ${selectedAmPm}`}
            </Text>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 30,
    maxHeight: '80%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  title: {
    fontSize: 17,
    fontWeight: '600',
    color: '#333',
  },
  cancelText: {
    fontSize: 16,
    color: '#666',
  },
  confirmText: {
    fontSize: 16,
    color: '#8B4513',
    fontWeight: '600',
  },
  dateSection: {
    padding: 16,
  },
  timeSection: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  sectionLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
    fontWeight: '500',
  },
  pickerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    height: 150,
  },
  pickerColumn: {
    flex: 2,
    maxHeight: 150,
  },
  pickerColumnSmall: {
    flex: 1,
    maxHeight: 150,
  },
  pickerItem: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  pickerItemSelected: {
    backgroundColor: '#FFF3E0',
    borderRadius: 8,
  },
  pickerItemDisabled: {
    opacity: 0.3,
  },
  pickerItemText: {
    fontSize: 16,
    color: '#333',
  },
  pickerItemTextSelected: {
    color: '#8B4513',
    fontWeight: '600',
  },
  pickerItemTextDisabled: {
    color: '#999',
  },
  timeSeparator: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginHorizontal: 8,
  },
  amPmColumn: {
    marginLeft: 12,
  },
  amPmButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginVertical: 4,
    backgroundColor: '#f5f5f5',
  },
  amPmButtonSelected: {
    backgroundColor: '#8B4513',
  },
  amPmText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  amPmTextSelected: {
    color: '#fff',
  },
  previewSection: {
    padding: 16,
    backgroundColor: '#f8f8f8',
    marginHorizontal: 16,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewLabel: {
    fontSize: 14,
    color: '#666',
    marginRight: 8,
  },
  previewText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#8B4513',
  },
});
