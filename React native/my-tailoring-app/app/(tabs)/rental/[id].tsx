
import React, { useState, useEffect, useMemo } from "react";
import {
  View,
  StyleSheet,
  Image,
  TouchableOpacity,
  ScrollView,
  Modal,
  Platform,
  Alert,
  ActivityIndicator,
} from "react-native";
import { Text } from "react-native-paper";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Calendar } from "react-native-calendars";
import { Picker } from "@react-native-picker/picker";
import { LinearGradient } from "expo-linear-gradient";
import { rentalService } from "../../../utils/rentalService";
import { cartService } from "../../../utils/apiService";
import RentalImageCarousel from "../../../components/RentalImageCarousel";

const SIZE_LABELS: Record<string, string> = {
  small: 'Small (S)',
  medium: 'Medium (M)',
  large: 'Large (L)',
  extra_large: 'Extra Large (XL)',
};

export default function RentalDetail() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [item, setItem] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [addingToCart, setAddingToCart] = useState(false);
  const [selectedSizeKey, setSelectedSizeKey] = useState<string | null>(null);
  const [selectedSizeQuantities, setSelectedSizeQuantities] = useState<Record<string, number>>({});
  const [selectedSizeDurations, setSelectedSizeDurations] = useState<Record<string, number>>({});
  const [selectedSizeStartDates, setSelectedSizeStartDates] = useState<Record<string, Date>>({});
  const [liveSizeAvailability, setLiveSizeAvailability] = useState<Record<string, number | null>>({});
  const [availabilityUpdatedAt, setAvailabilityUpdatedAt] = useState<string>('');
  const [availabilityAuthFailed, setAvailabilityAuthFailed] = useState(false);

  const today = new Date();
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [rentalDuration, setRentalDuration] = useState(3);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [tempStartDate, setTempStartDate] = useState<Date | null>(null);
  const [showCalendar, setShowCalendar] = useState(false);
  const [calendarTargetSizeKey, setCalendarTargetSizeKey] = useState<string | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [measurementUnit, setMeasurementUnit] = useState<'inch' | 'cm'>('inch');
  const [expandedMeasurementSize, setExpandedMeasurementSize] = useState<string | null>(null);

  const parseNumberLike = (value: any): number | null => {
    if (value === null || value === undefined || value === '') return null;
    const normalized = String(value).replace(/[^\d.-]/g, '');
    if (!normalized) return null;
    const parsed = parseFloat(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  };

  const normalizeSizeOption = (sizeKey: string, rawOption: any = {}, fallbackOption: any = {}) => {
    const quantityRaw = parseNumberLike(rawOption?.quantity ?? fallbackOption?.quantity);
    const quantity = quantityRaw === null ? null : Math.max(0, Math.floor(quantityRaw));

    const priceRaw = parseNumberLike(
      rawOption?.price ?? rawOption?.daily_rate ?? fallbackOption?.price ?? fallbackOption?.daily_rate ?? item?.price
    );
    const price = priceRaw === null ? 0 : Math.max(0, priceRaw);

    const depositRaw = parseNumberLike(
      rawOption?.deposit ??
      rawOption?.deposit_amount ??
      rawOption?.downpayment ??
      rawOption?.downPayment ??
      fallbackOption?.deposit ??
      fallbackOption?.deposit_amount ??
      fallbackOption?.downpayment ??
      fallbackOption?.downPayment
    );
    const deposit = depositRaw === null ? 0 : Math.max(0, depositRaw);

    const durationRaw = parseNumberLike(rawOption?.rental_duration ?? fallbackOption?.rental_duration ?? 3);
    const rentalDuration = durationRaw === null ? 3 : Math.max(1, Math.min(30, Math.floor(durationRaw)));

    const overdueRaw = parseNumberLike(rawOption?.overdue_amount ?? fallbackOption?.overdue_amount ?? 50);
    const overdueAmount = overdueRaw === null ? 50 : Math.max(0, overdueRaw);

    return {
      label:
        rawOption?.label ||
        fallbackOption?.label ||
        SIZE_LABELS[sizeKey] ||
        rawOption?.customLabel ||
        fallbackOption?.customLabel ||
        sizeKey,
      quantity,
      price,
      deposit,
      rental_duration: rentalDuration,
      overdue_amount: overdueAmount,
      measurements:
        rawOption?.measurements ||
        rawOption?.measurement_profile ||
        rawOption?.measurementProfile ||
        fallbackOption?.measurements ||
        fallbackOption?.measurement_profile ||
        fallbackOption?.measurementProfile ||
        null,
    };
  };

  const deriveSizeOptions = (sourceItem: any): Record<string, any> => {
    const byEntry: Record<string, any> = {};
    let parsed: any = null;
    const rawSize = sourceItem?.size;

    try {
      parsed = rawSize ? (typeof rawSize === 'string' ? JSON.parse(rawSize) : rawSize) : null;
    } catch {
      parsed = null;
    }

    if (parsed && typeof parsed === 'object' && Array.isArray(parsed.size_entries)) {
      parsed.size_entries.forEach((entry: any, idx: number) => {
        const baseKey = String(entry?.sizeKey || '').trim();
        const key = baseKey && baseKey !== 'custom' ? baseKey : (entry?.customLabel || `custom_${idx + 1}`);
        byEntry[key] = normalizeSizeOption(key, entry);
      });
    }

    const direct = sourceItem?.size_options;
    const structured = direct || parsed?.size_options || parsed?.sizeOptions || parsed?.size_options_v1 || parsed?.sizeOptionsV1;

    const byStructured: Record<string, any> = {};
    if (structured && typeof structured === 'object' && !Array.isArray(structured)) {
      Object.entries(structured).forEach(([key, value]) => {
        byStructured[key] = normalizeSizeOption(key, value, byEntry[key]);
      });
    }

    const merged: Record<string, any> = {};
    const keys = new Set([...Object.keys(byEntry), ...Object.keys(byStructured)]);
    keys.forEach((key) => {
      merged[key] = normalizeSizeOption(key, byStructured[key], byEntry[key]);
    });

    return merged;
  };

  const getAvailableSizeKeys = (sizeOptions: Record<string, any> = {}) => {
    return Object.keys(sizeOptions).filter((key) => {
      const qty = sizeOptions?.[key]?.quantity;
      if (qty === null || qty === undefined || qty === '') return true;
      const parsedQty = parseInt(String(qty), 10);
      return !Number.isNaN(parsedQty) && parsedQty > 0;
    });
  };

  const effectiveSizeOptions = useMemo(() => deriveSizeOptions(item), [item]);

  const getMeasurementValue = (measurement: any, unit: string): string | null => {
    if (!measurement) return null;

    if (typeof measurement === 'object' && measurement.inch !== undefined) {
      if (unit === 'inch') {
        return measurement.inch ? `${measurement.inch}"` : null;
      } else {
        return measurement.cm ? `${measurement.cm} cm` : null;
      }
    }

    if (typeof measurement === 'string' || typeof measurement === 'number') {
      const inchValue = String(measurement);
      if (unit === 'inch') {
        return `${inchValue}"`;
      } else {

        const num = parseFloat(inchValue);
        if (isNaN(num)) return null;
        return `${(num * 2.54).toFixed(1)} cm`;
      }
    }

    return null;
  };

  const getMeasurementsFromSource = (sourceData: any): { label: string; value: string }[] => {
    if (!sourceData) return [];

    try {
      let measurements;
      const sizeString = sourceData;

      if (typeof sizeString === 'string') {

        if (sizeString.startsWith('{') && !sizeString.endsWith('}')) {
          return [];
        }
        try {
          measurements = JSON.parse(sizeString);
        } catch (parseError) {
          return [];
        }
      } else {
        measurements = sizeString;
      }

      if (!measurements || typeof measurements !== 'object' || Array.isArray(measurements)) {
        return [];
      }

      const parts: { label: string; value: string }[] = [];
      const checkValue = (val: any) => {
        if (typeof val === 'object' && val !== null) {
          return (val.inch && val.inch !== '' && val.inch !== '0') ||
                 (val.cm && val.cm !== '' && val.cm !== '0');
        }
        return val && val !== '' && val !== '0';
      };

      const measurementKeys = [
        { key: 'chest', label: 'Chest' },
        { key: 'shoulders', label: 'Shoulders' },
        { key: 'sleeveLength', label: 'Sleeve Length' },
        { key: 'neck', label: 'Neck' },
        { key: 'waist', label: 'Waist' },
        { key: 'length', label: 'Length' },
        { key: 'hips', label: 'Hips' },
        { key: 'inseam', label: 'Inseam' },
        { key: 'outseam', label: 'Outseam' },
        { key: 'thigh', label: 'Thigh' },
      ];

      measurementKeys.forEach(({ key, label }) => {
        if (checkValue(measurements[key])) {
          const value = getMeasurementValue(measurements[key], measurementUnit);
          if (value) parts.push({ label, value });
        }
      });

      return parts;
    } catch (e) {
      return [];
    }
  };

  const getMeasurements = (): { label: string; value: string }[] => {
    if (!item) return [];
    return getMeasurementsFromSource(item.size);
  };

  const getMeasurementsForSize = (sizeKey: string): { label: string; value: string }[] => {
    const sizeOption = effectiveSizeOptions?.[sizeKey] || {};
    const source =
      sizeOption.measurements ||
      sizeOption.measurement_profile ||
      sizeOption.measurementProfile ||
      item?.measurement_profile ||
      item?.size;
    return getMeasurementsFromSource(source);
  };

  const calculateEndDate = (start: Date | null, duration: number): Date | null => {
    if (!start) return null;
    const endDateObj = new Date(start);
    endDateObj.setDate(start.getDate() + duration - 1);
    return endDateObj;
  };

  useEffect(() => {
    if (id) {
      fetchRentalDetails();
    }
  }, [id]);

  useEffect(() => {
    if (startDate && rentalDuration) {
      const calculatedEndDate = calculateEndDate(startDate, rentalDuration);
      setEndDate(calculatedEndDate);
    } else {
      setEndDate(null);
    }
  }, [startDate, rentalDuration]);

  const fetchRentalDetails = async () => {
    try {
      setLoading(true);
      setError('');
      const result = await rentalService.getRentalById(id as string);
      console.log('Rental details:', result);

      if (result.item) {
        const loaded = result.item;
        setItem(loaded);
        setSelectedSizeQuantities({});
        setSelectedSizeDurations({});
        setSelectedSizeStartDates({});
        setLiveSizeAvailability({});
        try {
          const sizeOpts = deriveSizeOptions(loaded);
          if (sizeOpts && typeof sizeOpts === 'object') {
            const availableKeys = getAvailableSizeKeys(sizeOpts);
            const firstKey = availableKeys[0] || null;
            const durationMap: Record<string, number> = {};
            availableKeys.forEach((sizeKey) => {
              const d = parseInt(String(sizeOpts?.[sizeKey]?.rental_duration ?? 3), 10);
              durationMap[sizeKey] = Number.isNaN(d) ? 3 : Math.min(30, Math.max(1, d));
            });
            setSelectedSizeDurations(durationMap);
            if (firstKey) {
              setSelectedSizeKey(firstKey);
              setSelectedSizeQuantities({ [firstKey]: 0 });
            }
          }
        } catch {}
        await fetchLiveAvailability(String(loaded?.item_id || id), loaded);
      } else {
        setError('Rental item not found');
      }
    } catch (err) {
      console.error('Error fetching rental:', err);
      setError('Failed to load rental details');
    } finally {
      setLoading(false);
    }
  };

  const fetchLiveAvailability = async (itemId: string, loadedItem?: any) => {
    if (availabilityAuthFailed) return;

    try {
      const response = await rentalService.getAvailableQuantity(itemId);
      if (response?.authError) {
        setAvailabilityAuthFailed(true);
        return;
      }
      const liveMap = response?.available_quantities || {};
      const sourceItem = loadedItem || item;
      const sizeOptions = deriveSizeOptions(sourceItem);

      if (!sizeOptions || Object.keys(sizeOptions).length === 0) {
        const liveDefault = parseInt(String(liveMap.__default), 10);
        setLiveSizeAvailability({ __default: Number.isNaN(liveDefault) ? null : Math.max(0, liveDefault) });
      } else {
        const mapped: Record<string, number | null> = {};
        Object.entries(sizeOptions).forEach(([sizeKey, opt]: any) => {
          const liveQty = parseInt(String(liveMap[sizeKey]), 10);
          mapped[sizeKey] = Number.isNaN(liveQty) ? null : Math.max(0, liveQty);
        });
        setLiveSizeAvailability(mapped);
      }

      setAvailabilityUpdatedAt(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    } catch {
      const sourceItem = loadedItem || item;
      const sizeOptions = deriveSizeOptions(sourceItem);
      if (sizeOptions && Object.keys(sizeOptions).length > 0) {
        const unknownMap: Record<string, number | null> = {};
        Object.keys(sizeOptions).forEach((sizeKey) => {
          unknownMap[sizeKey] = null;
        });
        setLiveSizeAvailability(unknownMap);
      }
    }
  };

  const getImageSource = () => {
    if (item?.image_url) {
      const imageUrl = rentalService.getImageUrl(item.image_url);
      if (imageUrl) {
        return { uri: imageUrl };
      }
    }
    return require("../../../assets/images/rent.jpg");
  };

  useEffect(() => {
    if (!id || !item) return;
    const intervalId = setInterval(() => {
      fetchLiveAvailability(String(id));
    }, 12000);

    return () => clearInterval(intervalId);
  }, [id, item, availabilityAuthFailed]);

  const getRentalImages = () => {
    if (!item) return [];

    console.log('=== RENTAL IMAGES DEBUG ===');
    console.log('front_image:', item.front_image);
    console.log('back_image:', item.back_image);
    console.log('side_image:', item.side_image);
    console.log('image_url:', item.image_url);
    console.log('===========================');

    return [
      { url: item.front_image ? rentalService.getImageUrl(item.front_image) : null, label: 'Front' },
      { url: item.back_image ? rentalService.getImageUrl(item.back_image) : null, label: 'Back' },
      { url: item.side_image ? rentalService.getImageUrl(item.side_image) : null, label: 'Side' },
      { url: item.image_url ? rentalService.getImageUrl(item.image_url) : null, label: 'Main' },
    ].filter(img => img.url);
  };

  const formatDate = (date: Date | null): string => {
    if (!date) return "Not selected";
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const getSizeEntries = () => {
    if (!effectiveSizeOptions || typeof effectiveSizeOptions !== 'object') return [] as Array<[string, any]>;
    const filteredKeys = getAvailableSizeKeys(effectiveSizeOptions as Record<string, any>);
    return filteredKeys.map((key) => [key, (effectiveSizeOptions as Record<string, any>)[key]]) as Array<[string, any]>;
  };

  const getSizeMaxQuantity = (sizeKey: string) => {
    const declared = parseInt(String(effectiveSizeOptions?.[sizeKey]?.quantity ?? ''), 10);
    if (!Number.isNaN(declared)) {
      return Math.max(0, declared);
    }

    const raw = liveSizeAvailability?.[sizeKey];
    const parsedLive = raw === null || raw === undefined ? null : parseInt(String(raw), 10);
    if (parsedLive !== null && !Number.isNaN(parsedLive)) {
      return Math.max(0, parsedLive);
    }

    return null;
  };

  const getSizeDuration = (sizeKey: string) => {
    const fromState = parseInt(String(selectedSizeDurations?.[sizeKey] ?? ''), 10);
    if (!Number.isNaN(fromState) && fromState > 0) return Math.min(30, Math.max(1, fromState));

    const fallback = parseInt(String(effectiveSizeOptions?.[sizeKey]?.rental_duration ?? 3), 10);
    return Number.isNaN(fallback) ? 3 : Math.min(30, Math.max(1, fallback));
  };

  const toIsoDate = (date: Date) => {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  };

  const getSizeStartDate = (sizeKey: string): Date | null => {
    return selectedSizeStartDates?.[sizeKey] || startDate || null;
  };

  const updateSizeDuration = (sizeKey: string, delta: number) => {
    const current = getSizeDuration(sizeKey);
    const next = Math.min(30, Math.max(1, current + delta));
    setSelectedSizeDurations((prev) => ({ ...prev, [sizeKey]: next }));
  };

  const getSizeEndDate = (sizeKey: string) => {
    const duration = getSizeDuration(sizeKey);
    const sizeStart = getSizeStartDate(sizeKey);
    return calculateEndDate(sizeStart, duration);
  };

  const getLongestSelectedDuration = () => {
    return Object.entries(selectedSizeQuantities)
      .filter(([, qty]) => parseInt(String(qty), 10) > 0)
      .reduce((maxDuration, [sizeKey]) => Math.max(maxDuration, getSizeDuration(sizeKey)), 0);
  };

  const calculateTotalForSizeSelections = () => {
    return Object.entries(selectedSizeQuantities)
      .filter(([, qty]) => parseInt(String(qty), 10) > 0)
      .reduce((total, [sizeKey, qty]) => {
        const quantity = parseInt(String(qty), 10);
        if (Number.isNaN(quantity) || quantity <= 0) return total;
        const duration = getSizeDuration(sizeKey);
        const price = parseFloat(effectiveSizeOptions?.[sizeKey]?.price || item?.price || '0') || 0;
        return total + (quantity * price * (duration / 3));
      }, 0);
  };

  const getTotalSelectedQuantity = () => {
    return Object.values(selectedSizeQuantities).reduce((sum, value) => {
      const qty = parseInt(String(value), 10);
      return sum + (Number.isNaN(qty) ? 0 : qty);
    }, 0);
  };

  const updateSizeQuantity = (sizeKey: string, delta: number) => {
    const maxQty = getSizeMaxQuantity(sizeKey);
    const currentQty = parseInt(String(selectedSizeQuantities[sizeKey] || 0), 10);
    const nextQty = Math.max(0, currentQty + delta);

    if (delta > 0 && maxQty === null) {
      Alert.alert('Stock Unavailable', 'Stock is not declared by admin yet for this size.');
      return;
    }

    if (delta > 0 && maxQty !== null && nextQty > maxQty) {
      const label = effectiveSizeOptions?.[sizeKey]?.label || sizeKey;
      Alert.alert('Out of Stock', `${label} is out of stock.`);
      return;
    }

    setSelectedSizeQuantities((prev) => {
      const next = { ...prev };
      if (nextQty <= 0) {
        delete next[sizeKey];
      } else {
        next[sizeKey] = nextQty;
      }
      return next;
    });
  };

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#94665B" />
        <Text style={{ marginTop: 12, color: '#6B7280' }}>Loading rental details...</Text>
      </View>
    );
  }

  if (error || !item) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center', padding: 20 }]}>
        <Ionicons name="alert-circle-outline" size={60} color="#EF4444" />
        <Text style={{ marginTop: 12, color: '#EF4444', fontSize: 16 }}>{error || 'Item not found'}</Text>
        <TouchableOpacity
          style={{ marginTop: 16, backgroundColor: '#94665B', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 8 }}
          onPress={() => router.push('/rental')}
        >
          <Text style={{ color: '#fff', fontWeight: '600' }}>Back to Rentals</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const calculateTotalCost = (duration: number, rentalItem: any): number => {
    if (!duration || !rentalItem || duration < 3) return 0;

    const validDuration = Math.floor(duration / 3) * 3;
    if (validDuration < 3) return 0;

    let basePrice = 500;
    if (rentalItem.price) {
      const priceStr = String(rentalItem.price).replace(/[^\d.]/g, '');
      const parsedPrice = parseFloat(priceStr);
      if (!isNaN(parsedPrice) && parsedPrice > 0) {
        basePrice = parsedPrice;
      }
    } else if (rentalItem.daily_rate) {

      const dailyRate = parseFloat(rentalItem.daily_rate) || 0;
      basePrice = dailyRate * 3;
    }

    return (validDuration / 3) * basePrice;
  };

  const calculateTotal = () => {
    if (getSizeEntries().length > 0) {
      return calculateTotalForSizeSelections();
    }
    if (!startDate) return 0;
    if (!rentalDuration) return 0;
    return calculateTotalCost(rentalDuration, item);
  };

  const getMarkedDates = () => {
    const marked: any = {};
    if (tempStartDate) {
      marked[tempStartDate.toISOString().split("T")[0]] = {
        selected: true,
        selectedColor: "#94665B",
        textColor: "white",
      };
    }
    return marked;
  };

  const handleDayPress = (day: any) => {
    const selected = new Date(day.dateString);
    setTempStartDate(selected);
  };

  const applyStartDate = () => {
    if (tempStartDate) {
      if (calendarTargetSizeKey) {
        setSelectedSizeStartDates((prev) => ({
          ...prev,
          [calendarTargetSizeKey]: tempStartDate,
        }));
      } else {
        setStartDate(tempStartDate);
      }

    }
    setCalendarTargetSizeKey(null);
    setShowCalendar(false);
  };

  const openGlobalDatePicker = () => {
    setCalendarTargetSizeKey(null);
    setTempStartDate(startDate);
    setShowCalendar(true);
  };

  const openSizeDatePicker = (sizeKey: string) => {
    setCalendarTargetSizeKey(sizeKey);
    setTempStartDate(getSizeStartDate(sizeKey));
    setShowCalendar(true);
  };

  const getSelectedSizeTerms = () => {
    return Object.entries(selectedSizeQuantities)
      .filter(([, qty]) => parseInt(String(qty), 10) > 0)
      .map(([sizeKey, qty]) => {
        const quantity = parseInt(String(qty), 10);
        const duration = getSizeDuration(sizeKey);
        const lineStartDate = getSizeStartDate(sizeKey);
        const lineDueDate = calculateEndDate(lineStartDate, duration);
        return {
          sizeKey,
          quantity,
          rental_duration: duration,
          startDate: lineStartDate,
          dueDate: lineDueDate,
        };
      });
  };

  const handleAddToCart = () => {
    if (getSizeEntries().length > 0 && getTotalSelectedQuantity() <= 0) {
      Alert.alert('Size Required', 'Please select at least one size quantity.');
      return;
    }
    if (getSizeEntries().length > 0) {
      const missingDateSize = getSelectedSizeTerms().find((term) => !term.startDate);
      if (missingDateSize) {
        const label = effectiveSizeOptions?.[missingDateSize.sizeKey]?.label || missingDateSize.sizeKey;
        Alert.alert('Missing Date', `Please select a start date for ${label}.`);
        return;
      }
    }
    if (getSizeEntries().length === 0) {
      if (!startDate) {
        Alert.alert("Missing Date", "Please select a start date");
        return;
      }
      if (rentalDuration < 3) {
        Alert.alert("Invalid Duration", "Minimum rental period is 3 days");
        return;
      }
      if (rentalDuration > 30) {
        Alert.alert("Too Long", "Maximum rental period is 30 days");
        return;
      }
      if (rentalDuration % 3 !== 0) {
        Alert.alert("Invalid Duration", "Rental duration must be a multiple of 3 days (3, 6, 9, 12, etc.)");
        return;
      }
    }
    setShowConfirmModal(true);
  };

  const confirmAddToCart = async () => {
    try {
      setAddingToCart(true);
      const totalPrice = calculateTotal();
      const hasSizeOptions = getSizeEntries().length > 0;
      const selectedTerms = hasSizeOptions ? getSelectedSizeTerms() : [];
      const longestDuration = hasSizeOptions
        ? selectedTerms.reduce((maxDuration, term) => Math.max(maxDuration, term.rental_duration), 0)
        : rentalDuration;
      const earliestStart = hasSizeOptions
        ? selectedTerms
            .map((term) => term.startDate)
            .filter((date): date is Date => !!date)
            .sort((a, b) => a.getTime() - b.getTime())[0] || null
        : startDate;
      const latestDue = hasSizeOptions
        ? selectedTerms
            .map((term) => term.dueDate)
            .filter((date): date is Date => !!date)
            .sort((a, b) => b.getTime() - a.getTime())[0] || null
        : null;
      const calculatedEndDate = hasSizeOptions ? latestDue : (endDate || calculateEndDate(startDate, longestDuration));

      if (!calculatedEndDate) {
        Alert.alert("Error", "Unable to calculate end date");
        return;
      }

      const rentalData = {
        serviceType: 'rental',
        serviceId: item.item_id,
        quantity: getSizeEntries().length > 0 ? getTotalSelectedQuantity() : 1,
        basePrice: item.price || item.daily_rate * 3 || '0',
        finalPrice: totalPrice.toString(),
        pricingFactors: {
          rental_duration: longestDuration,
          base_price_per_3_days: item.price || item.daily_rate * 3 || '0',
          deposit_amount: item.deposit_amount || '0'
        },
        specificData: {
          item_name: item.item_name,
          brand: item.brand || '',
          size: selectedSizeKey ? (effectiveSizeOptions?.[selectedSizeKey]?.label || selectedSizeKey) : (item.size || ''),
          size_options: effectiveSizeOptions || {},
          selected_sizes: getSizeEntries().length > 0
            ? Object.entries(selectedSizeQuantities)
                .filter(([, qty]) => parseInt(String(qty), 10) > 0)
                .map(([sizeKey, qty]) => ({
                  start_date: (() => {
                    const lineStartDate = getSizeStartDate(sizeKey);
                    return lineStartDate ? toIsoDate(lineStartDate) : '';
                  })(),
                  rental_duration: getSizeDuration(sizeKey),
                  overdue_amount: Math.max(0, parseFloat(effectiveSizeOptions?.[sizeKey]?.overdue_amount || 50) || 50),
                  due_date: (() => {
                    const dueDate = getSizeEndDate(sizeKey);
                    return dueDate ? toIsoDate(dueDate) : '';
                  })(),
                  sizeKey,
                  quantity: parseInt(String(qty), 10),
                  price: parseFloat(effectiveSizeOptions?.[sizeKey]?.price || item.price || '0') || 0,
                  deposit: parseFloat(effectiveSizeOptions?.[sizeKey]?.deposit || 0) || 0,
                  label: effectiveSizeOptions?.[sizeKey]?.label || sizeKey
                }))
            : [{
                sizeKey: 'default',
                quantity: 1,
                rental_duration: rentalDuration,
                overdue_amount: 50,
                due_date: calculatedEndDate
                  ? `${calculatedEndDate.getFullYear()}-${String(calculatedEndDate.getMonth() + 1).padStart(2, '0')}-${String(calculatedEndDate.getDate()).padStart(2, '0')}`
                  : '',
                price: parseFloat(item.price || item.daily_rate || '0') || 0,
                label: String(item.size || 'Standard')
              }],
          category: item.category || '',
          color: item.color || '',
          material: item.material || '',
          description: item.description || '',
          image_url: item.image_url,
          front_image: item.front_image || null,
          back_image: item.back_image || null,
          side_image: item.side_image || null,
        },
        rentalDates: {
          startDate: earliestStart ? toIsoDate(earliestStart) : '',
          endDate: toIsoDate(calculatedEndDate)
        }
      };

      const result = await cartService.addToCart(rentalData);

      if (result.success) {
        setShowConfirmModal(false);
        Alert.alert("Success!", "Rental added to cart!", [
          { text: "View Cart", onPress: () => router.push("/cart/Cart") },
          { text: "Continue", onPress: () => router.push("/rental") },
        ]);
      } else {
        Alert.alert("Error", result.message || "Failed to add to cart");
      }
    } catch (error) {
      console.error('Add to cart error:', error);
      Alert.alert("Error", "Failed to add rental to cart. Please try again.");
    } finally {
      setAddingToCart(false);
    }
  };

  return (
    <>
      <ScrollView style={styles.container}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => router.replace("/home")}
        >
          <Ionicons name="arrow-back" size={26} color="#fff" />
        </TouchableOpacity>
        <RentalImageCarousel
          images={getRentalImages()}
          itemName={item.item_name}
          fallbackImage={require("../../../assets/images/rent.jpg")}
          imageHeight={380}
          showFullscreen={true}
        />

        <View style={styles.sheet}>
          <LinearGradient
            colors={["#78350F", "#92400E"]}
            style={styles.titleBadge}
          >
            <Text style={styles.titleText}>{item.item_name}</Text>
          </LinearGradient>

          <View style={styles.priceSection}>
            <Text style={styles.priceLabel}>Rental Price</Text>
            <Text style={styles.priceValue}>
              ₱{(() => {

                const basePrice = item.price || (item.daily_rate ? item.daily_rate * 3 : 0);
                return parseFloat(String(basePrice).replace(/[^\d.]/g, '') || "0").toLocaleString();
              })()}/3 days
            </Text>
          </View>
          {Object.keys(effectiveSizeOptions || {}).length > 0 && (
            <View style={styles.sizeSection}>
              <View style={styles.sizeSectionHeader}>
                <Text style={styles.sizeSectionLabel}>SIZES & QUANTITIES</Text>
                <TouchableOpacity
                  style={styles.stockRefreshButton}
                  onPress={() => fetchLiveAvailability(String(item.item_id || id))}
                  activeOpacity={0.8}
                >
                  <Ionicons name="refresh" size={14} color="#78350F" />
                  <Text style={styles.stockRefreshText}>Refresh Stock</Text>
                </TouchableOpacity>
              </View>
              {!!availabilityUpdatedAt && (
                <Text style={styles.stockUpdatedText}>Live stock updated {availabilityUpdatedAt}</Text>
              )}
              <View style={styles.sizeRows}>
                {getSizeEntries().map(([key, opt]: any) => {
                  const selectedQty = parseInt(String(selectedSizeQuantities[key] || 0), 10);
                  const maxQty = getSizeMaxQuantity(key);
                  const selectedDuration = getSizeDuration(key);
                  const lineStartDate = getSizeStartDate(key);
                  const lineEndDate = getSizeEndDate(key);
                  const sizeMeasurements = getMeasurementsForSize(key);
                  const unitPrice = parseFloat(String(opt?.price ?? item?.price ?? '0')) || 0;
                  const unitDeposit = parseFloat(String(opt?.deposit ?? 0)) || 0;
                  const isMeasurementsOpen = expandedMeasurementSize === key;
                  return (
                    <View key={key} style={styles.sizeRow}>
                      <View style={styles.sizeHeaderRow}>
                        <TouchableOpacity
                          style={[
                            styles.sizeChip,
                            selectedSizeKey === key && styles.sizeChipActive
                          ]}
                          onPress={() => setSelectedSizeKey(key)}
                          activeOpacity={0.85}
                        >
                          <Text
                            style={[
                              styles.sizeChipText,
                              selectedSizeKey === key && styles.sizeChipTextActive
                            ]}
                          >
                            {(opt?.label || key)}
                          </Text>
                        </TouchableOpacity>
                        <View style={styles.sizeMetaRow}>
                          <Text style={styles.sizeMetaText}>₱{unitPrice.toLocaleString()} / 3 days</Text>
                          {unitDeposit > 0 && (
                            <Text style={[styles.sizeMetaText, styles.sizeDepositText]}>Deposit: ₱{unitDeposit.toLocaleString()}</Text>
                          )}
                        </View>
                      </View>
                      <View style={styles.sizeQuantityRow}>
                        <View style={styles.qtyControls}>
                        <TouchableOpacity
                          style={styles.qtyButton}
                          onPress={() => updateSizeQuantity(key, -1)}
                          disabled={selectedQty <= 0}
                        >
                          <Text style={[styles.qtyButtonText, selectedQty <= 0 && styles.qtyButtonTextDisabled]}>-</Text>
                        </TouchableOpacity>
                        <Text style={styles.qtyValue}>{selectedQty}</Text>
                        <TouchableOpacity
                          style={styles.qtyButton}
                          onPress={() => updateSizeQuantity(key, 1)}
                          disabled={maxQty === null || selectedQty >= maxQty}
                        >
                          <Text style={[styles.qtyButtonText, (maxQty === null || selectedQty >= maxQty) && styles.qtyButtonTextDisabled]}>+</Text>
                        </TouchableOpacity>
                        </View>
                        <Text style={styles.stockText}>Stock: {maxQty === null ? 0 : maxQty}</Text>
                      </View>
                      <View style={styles.sizeDurationRow}>
                        <Text style={styles.sizeDurationLabel}>Duration:</Text>
                        <View style={styles.durationStepControls}>
                          <TouchableOpacity style={styles.durationStepBtn} onPress={() => updateSizeDuration(key, -1)}>
                            <Text style={styles.durationStepBtnText}>-</Text>
                          </TouchableOpacity>
                          <Text style={styles.durationStepValue}>{selectedDuration}</Text>
                          <TouchableOpacity style={styles.durationStepBtn} onPress={() => updateSizeDuration(key, 1)}>
                            <Text style={styles.durationStepBtnText}>+</Text>
                          </TouchableOpacity>
                        </View>
                        <Text style={styles.sizeDurationDays}>days</Text>
                        {sizeMeasurements.length > 0 && (
                          <TouchableOpacity
                            style={styles.measurementsChipBtn}
                            onPress={() => setExpandedMeasurementSize(isMeasurementsOpen ? null : key)}
                            activeOpacity={0.85}
                          >
                            <Text style={styles.measurementsChipBtnText}>MEASUREMENTS</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                      <TouchableOpacity
                        style={styles.sizeDatePickerBtn}
                        onPress={() => openSizeDatePicker(key)}
                        activeOpacity={0.85}
                      >
                        <Ionicons name="calendar-outline" size={16} color="#78350F" />
                        <Text style={styles.sizeDatePickerText}>
                          Start Date ({opt?.label || key}): {lineStartDate ? formatDate(lineStartDate) : 'Select date'}
                        </Text>
                      </TouchableOpacity>
                      <Text style={styles.sizeEndDateText}>
                        End Date ({opt?.label || key}): {lineEndDate ? formatDate(lineEndDate) : 'Select start date'}
                      </Text>
                      {isMeasurementsOpen && sizeMeasurements.length > 0 && (
                        <View style={styles.rowMeasurementsPanel}>
                          <View style={styles.rowMeasurementsUnitToggle}>
                            <TouchableOpacity
                              style={[
                                styles.rowMeasurementsUnitBtn,
                                measurementUnit === 'inch' && styles.rowMeasurementsUnitBtnActive,
                              ]}
                              onPress={() => setMeasurementUnit('inch')}
                            >
                              <Text
                                style={[
                                  styles.rowMeasurementsUnitBtnText,
                                  measurementUnit === 'inch' && styles.rowMeasurementsUnitBtnTextActive,
                                ]}
                              >
                                IN
                              </Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={[
                                styles.rowMeasurementsUnitBtn,
                                measurementUnit === 'cm' && styles.rowMeasurementsUnitBtnActive,
                              ]}
                              onPress={() => setMeasurementUnit('cm')}
                            >
                              <Text
                                style={[
                                  styles.rowMeasurementsUnitBtnText,
                                  measurementUnit === 'cm' && styles.rowMeasurementsUnitBtnTextActive,
                                ]}
                              >
                                CM
                              </Text>
                            </TouchableOpacity>
                          </View>
                          {sizeMeasurements.map((m, idx) => (
                            <View key={`${key}-m-${idx}`} style={styles.rowMeasurementLine}>
                              <Text style={styles.rowMeasurementLabel}>{m.label}</Text>
                              <Text style={styles.rowMeasurementValue}>{m.value}</Text>
                            </View>
                          ))}
                        </View>
                      )}
                    </View>
                  );
                })}
              </View>
              <Text style={styles.totalQtyText}>Selected total: {getTotalSelectedQuantity()}</Text>
            </View>
          )}
          <View style={styles.detailsGrid}>
            {[
              { key: "color", icon: "color-palette-outline", value: item.color },
              { key: "brand", icon: "business-outline", value: item.brand },
              { key: "material", icon: "shirt-outline", value: item.material },
            ].map((detail) => (
              <View key={detail.key} style={styles.detailItem}>
                <Ionicons
                  name={detail.icon as any}
                  size={20}
                  color="#94665B"
                />
                <Text style={styles.detailLabel}>
                  {detail.key.charAt(0).toUpperCase() + detail.key.slice(1)}
                </Text>
                <Text style={styles.detailValue}>{detail.value || "N/A"}</Text>
              </View>
            ))}
          </View>
          {getSizeEntries().length === 0 && getMeasurements().length > 0 && (
            <View style={styles.measurementsSection}>
              <View style={styles.measurementsHeader}>
                <TouchableOpacity
                  style={styles.measurementsToggleBtn}
                  onPress={() => setExpandedMeasurementSize(expandedMeasurementSize === '__default' ? null : '__default')}
                >
                  <Ionicons name="resize-outline" size={18} color="#fff" />
                  <Text style={styles.measurementsToggleBtnText}>
                    {expandedMeasurementSize === '__default' ? 'Hide Measurements' : 'Show Measurements'}
                  </Text>
                  <Ionicons
                    name={expandedMeasurementSize === '__default' ? "chevron-up" : "chevron-down"}
                    size={16}
                    color="#fff"
                  />
                </TouchableOpacity>
              </View>

              {expandedMeasurementSize === '__default' && (
                <View style={styles.measurementsContent}>
                  <View style={styles.unitToggleContainer}>
                    <TouchableOpacity
                      style={[
                        styles.unitToggleBtn,
                        measurementUnit === 'inch' && styles.unitToggleBtnActive
                      ]}
                      onPress={() => setMeasurementUnit('inch')}
                    >
                      <Text style={[
                        styles.unitToggleBtnText,
                        measurementUnit === 'inch' && styles.unitToggleBtnTextActive
                      ]}>Inch</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.unitToggleBtn,
                        measurementUnit === 'cm' && styles.unitToggleBtnActive
                      ]}
                      onPress={() => setMeasurementUnit('cm')}
                    >
                      <Text style={[
                        styles.unitToggleBtnText,
                        measurementUnit === 'cm' && styles.unitToggleBtnTextActive
                      ]}>CM</Text>
                    </TouchableOpacity>
                  </View>
                  <View style={styles.measurementsList}>
                    {getMeasurements().map((m, idx) => (
                      <View key={idx} style={styles.measurementRow}>
                        <Text style={styles.measurementLabel}>{m.label}</Text>
                        <Text style={styles.measurementValue}>{m.value}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}
            </View>
          )}

          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Rental Period</Text>
            <TouchableOpacity
              style={styles.calendarBtn}
              onPress={openGlobalDatePicker}
            >
              <Ionicons name="calendar-outline" size={22} color="#94665B" />
              <View style={{ flex: 1, marginLeft: 12 }}>
                {startDate ? (
                  <Text style={styles.dateText}>
                    Default Start: {formatDate(startDate)}
                  </Text>
                ) : (
                  <Text style={styles.placeholderText}>
                    Tap to select default start date
                  </Text>
                )}
              </View>
              <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
            </TouchableOpacity>
            {getSizeEntries().length === 0 && (
              <View style={styles.durationContainer}>
                <Text style={styles.durationLabel}>Rental Duration *</Text>
                <View style={styles.pickerContainer}>
                  <Picker
                    selectedValue={rentalDuration}
                    onValueChange={(value) => setRentalDuration(value)}
                    style={styles.picker}
                  >
                    <Picker.Item label="3 days" value={3} />
                    <Picker.Item label="6 days" value={6} />
                    <Picker.Item label="9 days" value={9} />
                    <Picker.Item label="12 days" value={12} />
                    <Picker.Item label="15 days" value={15} />
                    <Picker.Item label="18 days" value={18} />
                    <Picker.Item label="21 days" value={21} />
                    <Picker.Item label="24 days" value={24} />
                    <Picker.Item label="27 days" value={27} />
                    <Picker.Item label="30 days" value={30} />
                  </Picker>
                </View>
              </View>
            )}
            {getSizeEntries().length > 0 && (
              <Text style={styles.sizeDurationHint}>Each selected size uses its own duration above.</Text>
            )}
            {startDate && (getSizeEntries().length === 0 ? endDate : calculateEndDate(startDate, getLongestSelectedDuration())) && (
              <View style={styles.endDateContainer}>
                <Text style={styles.endDateLabel}>End Date (Auto-calculated)</Text>
                <Text style={styles.endDateValue}>
                  {formatDate(getSizeEntries().length > 0 ? calculateEndDate(startDate, getLongestSelectedDuration()) : endDate)}
                </Text>
              </View>
            )}
            {startDate && (getSizeEntries().length > 0 ? getTotalSelectedQuantity() > 0 : rentalDuration > 0) && (
              <View style={styles.totalSection}>
                <Text style={styles.totalLabel}>Total Cost</Text>
                <Text style={styles.totalValue}>
                  ₱{calculateTotal().toLocaleString()}
                </Text>
              </View>
            )}
          </View>

          <TouchableOpacity style={styles.addBtn} onPress={handleAddToCart}>
            <LinearGradient
              colors={["#78350F", "#92400E"]}
              style={StyleSheet.absoluteFillObject}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            />
            <Ionicons name="cart" size={24} color="#fff" />
            <Text style={styles.addBtnText}>ADD TO CART  ₱{calculateTotal().toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
          </TouchableOpacity>

          <View style={styles.policyCard}>
            <Text style={styles.policyTitle}>Rental Policy</Text>
            <View style={styles.policyRow}>
              <Ionicons name="checkmark-circle" size={16} color="#10B981" />
              <Text style={styles.policyText}>Minimum 3 days rental period</Text>
            </View>
            <View style={styles.policyRow}>
              <Ionicons name="checkmark-circle" size={16} color="#10B981" />
              <Text style={styles.policyText}>Maximum 30 days rental period</Text>
            </View>
            <View style={styles.policyRow}>
              <Ionicons name="alert-circle" size={16} color="#F59E0B" />
              <Text style={styles.policyText}>Late return: ₱100 per day</Text>
            </View>
          </View>
        </View>
        <Modal visible={showCalendar} animationType="slide">
          <View style={styles.calendarModal}>
            <View style={styles.calendarHeader}>
              <TouchableOpacity onPress={() => setShowCalendar(false)}>
                <Ionicons name="close" size={28} color="#1F2937" />
              </TouchableOpacity>
              <Text style={styles.calendarTitle}>Select Start Date</Text>
              <TouchableOpacity
                onPress={applyStartDate}
                disabled={!tempStartDate}
              >
                <Text
                  style={[
                    styles.doneText,
                    !tempStartDate && { color: "#ccc" },
                  ]}
                >
                  Done
                </Text>
              </TouchableOpacity>
            </View>

            <Calendar
              minDate={today.toISOString().split("T")[0]}
              onDayPress={handleDayPress}
              markedDates={getMarkedDates()}
              theme={{
                selectedDayBackgroundColor: "#94665B",
                todayTextColor: "#94665B",
                arrowColor: "#94665B",
                monthTextColor: "#1F2937",
                textDayFontWeight: "600",
              }}
            />

            {tempStartDate && (
              <View style={styles.selectionSummary}>
                <Text style={styles.summaryText}>
                  Selected: {formatDate(tempStartDate)}
                </Text>
                <Text style={styles.summarySubtext}>
                  End date will be calculated based on duration
                </Text>
              </View>
            )}
          </View>
        </Modal>
        <Modal visible={showConfirmModal} transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalIcon}>
                <Ionicons
                  name="calendar-clear-outline"
                  size={48}
                  color="#94665B"
                />
              </View>
              <Text style={styles.modalTitle}>Confirm Rental</Text>
              <Text style={styles.modalValue}>{item.item_name}</Text>
              {getSizeEntries().length > 0 && (
                <Text style={styles.modalValue}>
                  Sizes: {Object.entries(selectedSizeQuantities)
                    .filter(([, qty]) => parseInt(String(qty), 10) > 0)
                    .map(([sizeKey, qty]) => `${effectiveSizeOptions?.[sizeKey]?.label || sizeKey} x${qty} (${getSizeDuration(sizeKey)}d)`)
                    .join(', ')}
                </Text>
              )}
              <Text style={styles.modalValue}>
                {formatDate(startDate)} → {formatDate(getSizeEntries().length > 0 ? calculateEndDate(startDate, getLongestSelectedDuration()) : endDate)}
              </Text>
              {getSizeEntries().length === 0 && (
                <Text style={styles.modalValue}>
                  {rentalDuration} day{rentalDuration > 1 ? "s" : ""}
                </Text>
              )}
              <View style={styles.costBreakdown}>
                <View style={styles.costRow}>
                  <Text style={styles.costLabel}>
                    Base Price (per 3 days)
                  </Text>
                  <Text style={styles.costValue}>
                    ₱{(() => {
                      const basePrice = item.price || (item.daily_rate ? item.daily_rate * 3 : 0);
                      return parseFloat(String(basePrice).replace(/[^\d.]/g, '') || "0").toLocaleString();
                    })()}
                  </Text>
                </View>
                <View style={styles.costRow}>
                  <Text style={styles.costLabel}>
                    {getSizeEntries().length > 0
                      ? 'Per-size quantity × (duration ÷ 3) × size price'
                      : `(${rentalDuration} days ÷ 3) × Base Price`}
                  </Text>
                  <Text style={styles.costValue}>
                    ₱{calculateTotal().toLocaleString()}
                  </Text>
                </View>
                <View style={styles.costDivider} />
              </View>

              <View style={styles.modalTotal}>
                <Text style={styles.modalTotalLabel}>Total</Text>
                <Text style={styles.modalTotalValue}>
                  ₱{calculateTotal().toLocaleString()}
                </Text>
              </View>
              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={styles.modalCancelButton}
                  onPress={() => setShowConfirmModal(false)}
                >
                  <Text style={styles.modalCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.modalConfirmButton}
                  onPress={confirmAddToCart}
                >
                  <Text style={styles.modalConfirmText}>Add to Cart</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  titleBadge: {
    alignSelf: "center",
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 30,
    shadowColor: "#78350F",
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 12,
  },
  titleText: { color: "#fff", fontSize: 18, fontWeight: "800" },
  backBtn: {
    position: "absolute",
    top: Platform.OS === "ios" ? 60 : 40,
    left: 16,
    zIndex: 20,
    backgroundColor: "rgba(0,0,0,0.5)",
    padding: 12,
    borderRadius: 30,
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 8,
  },
  imageContainer: {
    position: "relative",
  },
  image: {
    width: "100%",
    height: 380,
  },
  imageOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.25)",
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 0,
  },
  tapToZoom: {
    color: "#fff",
    marginTop: 8,
    fontSize: 14,
    fontWeight: "600",
    textShadowColor: "rgba(0,0,0,0.7)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  sheet: {
    marginTop: -30,
    backgroundColor: "#fff",
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 40,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 10,
  },
  priceSection: {
    marginTop: 24,
    alignItems: "center",
    paddingVertical: 20,
    backgroundColor: "#FDF4F0",
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: "#F5ECE3",
  },
  priceLabel: {
    fontSize: 15,
    color: "#78716C",
    marginBottom: 6,
    fontWeight: "600",
  },
  sectionLabel: {
    fontSize: 19,
    fontWeight: "800",
    color: "#0F172A",
    letterSpacing: 0.3,
    marginBottom: 16,
    paddingBottom: 10,
    borderBottomWidth: 2,
    borderBottomColor: "#FDE68A",
    alignSelf: "flex-start",
  },
  priceValue: {
    fontSize: 32,
    fontWeight: "900",
    color: "#94665B",
    letterSpacing: 0.5,
  },
  detailsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginTop: 28,
    gap: 12,
  },
  detailItem: {
    width: "48%",
    backgroundColor: "#FAFAFA",
    padding: 18,
    borderRadius: 16,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#F0F0F0",
  },
  detailLabel: {
    fontSize: 12.5,
    color: "#78716C",
    marginTop: 10,
  },
  detailValue: {
    fontSize: 15,
    fontWeight: "700",
    color: "#1F2937",
    marginTop: 6,
  },
  section: { marginTop: 36 },
  sectionTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#0F172A",
    marginBottom: 16,
  },
  description: { fontSize: 15.5, color: "#52525B", lineHeight: 24 },
  sizeSection: { marginTop: 20 },
  sizeSectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  sizeSectionLabel: { fontSize: 20, fontWeight: "800", color: "#5B3A0E", letterSpacing: 0.4 },
  stockRefreshButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 14,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: "#FFFBEB",
  },
  stockRefreshText: { fontSize: 10, fontWeight: "700", color: "#78350F" },
  stockUpdatedText: { fontSize: 11, color: "#6B7280", marginBottom: 10 },
  sizeChips: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  sizeRows: { gap: 10 },
  sizeRow: {
    borderWidth: 1,
    borderColor: "#D8D2C9",
    borderRadius: 14,
    padding: 12,
    backgroundColor: "#F7F5F1",
    gap: 10,
  },
  sizeHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
  },
  sizeChip: {
    paddingVertical: 2,
    paddingHorizontal: 2,
    borderRadius: 8,
    backgroundColor: "transparent",
    borderWidth: 0,
    borderColor: "transparent",
  },
  sizeChipActive: {
    backgroundColor: "transparent",
    borderColor: "transparent",
  },
  sizeChipText: { fontSize: 19, fontWeight: "800", color: "#1F2937" },
  sizeChipTextActive: { color: "#111827", textDecorationLine: "underline" },
  sizeQuantityRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  qtyControls: { flexDirection: "row", alignItems: "center", gap: 8 },
  qtyButton: {
    width: 34,
    height: 34,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#D1D5DB",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fff",
  },
  qtyButtonText: { fontSize: 18, fontWeight: "700", color: "#6B7280" },
  qtyButtonTextDisabled: { color: "#C4C4C4" },
  qtyValue: { minWidth: 28, textAlign: "center", fontSize: 18, fontWeight: "800", color: "#111827" },
  stockText: { fontSize: 12, color: "#7A7165", fontWeight: "600" },
  sizeMetaRow: {
    flexDirection: "column",
    alignItems: "flex-end",
    gap: 8,
  },
  sizeMetaText: {
    fontSize: 13,
    color: "#5A5045",
    fontWeight: "600",
  },
  sizeDepositText: {
    color: "#B94A48",
  },
  sizeDurationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  sizeDurationLabel: {
    fontSize: 13,
    color: "#1F2937",
    fontWeight: "700",
  },
  durationStepControls: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 10,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#D1D5DB",
    backgroundColor: "#fff",
  },
  durationStepBtn: {
    width: 32,
    height: 30,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F9FAFB",
  },
  durationStepBtnText: {
    fontSize: 16,
    fontWeight: "800",
    color: "#6B7280",
  },
  durationStepValue: {
    minWidth: 34,
    textAlign: "center",
    fontSize: 15,
    fontWeight: "700",
    color: "#111827",
  },
  sizeDurationDays: {
    fontSize: 12,
    color: "#6B7280",
    fontWeight: "600",
  },
  measurementsChipBtn: {
    marginLeft: "auto",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 8,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  measurementsChipBtnText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#6B7280",
  },
  sizeEndDateText: {
    fontSize: 13,
    color: "#374151",
    fontWeight: "600",
  },
  sizeDatePickerBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#FFFBEB",
    borderWidth: 1,
    borderColor: "#FCD34D",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  sizeDatePickerText: {
    fontSize: 12,
    color: "#78350F",
    fontWeight: "700",
  },
  rowMeasurementsPanel: {
    marginTop: 8,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 10,
    padding: 10,
    gap: 6,
  },
  rowMeasurementsUnitToggle: {
    flexDirection: "row",
    alignSelf: "flex-end",
    backgroundColor: "#F3F4F6",
    borderRadius: 14,
    padding: 2,
    marginBottom: 4,
  },
  rowMeasurementsUnitBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  rowMeasurementsUnitBtnActive: {
    backgroundColor: "#111827",
  },
  rowMeasurementsUnitBtnText: {
    fontSize: 11,
    color: "#6B7280",
    fontWeight: "700",
  },
  rowMeasurementsUnitBtnTextActive: {
    color: "#FFFFFF",
  },
  rowMeasurementLine: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
    paddingBottom: 4,
  },
  rowMeasurementLabel: {
    fontSize: 12,
    color: "#4B5563",
    fontWeight: "600",
  },
  rowMeasurementValue: {
    fontSize: 12,
    color: "#111827",
    fontWeight: "700",
  },
  totalQtyText: { marginTop: 8, fontSize: 13, color: "#78350F", fontWeight: "700" },
  sizeDurationHint: {
    marginTop: 8,
    fontSize: 12,
    color: "#6B7280",
    fontWeight: "600",
  },
  calendarBtn: {
    backgroundColor: "#FAFAFA",
    padding: 18,
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: "#E5E7EB",
    marginBottom: 16,
  },
  dateText: { fontSize: 16, fontWeight: "700", color: "#1F2937" },
  daysText: { fontSize: 14, color: "#94665B", marginTop: 6, fontWeight: "600" },
  placeholderText: { fontSize: 15.5, color: "#9CA3AF", fontWeight: "500" },
  totalSection: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#FDF4F0",
    padding: 20,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: "#F5ECE3",
  },
  totalLabel: {
    fontSize: 17,
    fontWeight: "700",
    color: "#1F2937",
  },
  totalValue: {
    fontSize: 28,
    fontWeight: "900",
    color: "#94665B",
  },
  addBtn: {
    marginTop: 36,
    height: 62,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 31,
    gap: 12,
    shadowColor: "#78350F",
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 16,
  },
  addBtnText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    backgroundColor: "#fff",
    borderRadius: 28,
    padding: 36,
    width: "92%",
    maxWidth: 420,
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 20,
  },
  modalIcon: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "#FDF4F0",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 24,
  },
  modalTitle: {
    fontSize: 26,
    fontWeight: "900",
    color: "#1F2937",
    marginBottom: 28,
  },
  modalValue: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1F2937",
    marginBottom: 8,
    textAlign: "center",
  },
  costBreakdown: {
    width: "100%",
    marginVertical: 20,
    paddingVertical: 16,
  },
  costRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  costLabel: {
    fontSize: 14,
    color: "#6B7280",
    fontWeight: "500",
  },
  costValue: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1F2937",
  },
  costDivider: {
    height: 1,
    backgroundColor: "#E5E7EB",
    marginVertical: 8,
  },
  modalTotal: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
    backgroundColor: "#FAFAFA",
    padding: 24,
    borderRadius: 20,
    marginBottom: 32,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  modalTotalLabel: {
    fontSize: 19,
    fontWeight: "700",
    color: "#1F2937",
  },
  modalTotalValue: {
    fontSize: 32,
    fontWeight: "900",
    color: "#94665B",
  },
  modalButtons: {
    flexDirection: "row",
    gap: 16,
    width: "100%",
  },
  modalCancelButton: {
    flex: 1,
    backgroundColor: "#F3F4F6",
    paddingVertical: 18,
    borderRadius: 20,
    alignItems: "center",
  },
  modalCancelText: {
    color: "#6B7280",
    fontWeight: "700",
    fontSize: 16,
  },
  modalConfirmButton: {
    flex: 1,
    backgroundColor: "#94665B",
    paddingVertical: 18,
    borderRadius: 20,
    alignItems: "center",
  },
  modalConfirmText: {
    color: "#fff",
    fontWeight: "800",
    fontSize: 16,
  },
  calendarModal: {
    flex: 1,
    backgroundColor: "#fff",
    marginTop: Platform.OS === "ios" ? 50 : 20,
  },
  calendarHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  calendarTitle: { fontSize: 19, fontWeight: "800", color: "#1F2937" },
  doneText: { fontSize: 17, fontWeight: "700", color: "#94665B" },
  selectionSummary: {
    padding: 24,
    backgroundColor: "#FDF4F0",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: "#F5ECE3",
  },
  summaryText: { fontSize: 17, fontWeight: "700", color: "#94665B" },
  summarySubtext: {
    fontSize: 14,
    color: "#6B7280",
    marginTop: 6,
  },
  durationContainer: {
    marginTop: 16,
  },
  durationLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1F2937",
    marginBottom: 8,
  },
  pickerContainer: {
    backgroundColor: "#FAFAFA",
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: "#E5E7EB",
    overflow: "hidden",
  },
  picker: {
    height: 50,
    width: "100%",
  },
  endDateContainer: {
    marginTop: 16,
    backgroundColor: "#F9FAFB",
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  endDateLabel: {
    fontSize: 13,
    color: "#6B7280",
    marginBottom: 6,
  },
  endDateValue: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1F2937",
  },
  policyCard: {
    marginTop: 36,
    backgroundColor: "#FAFAFA",
    padding: 24,
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: "#E5E7EB",
  },
  policyTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#0F172A",
    marginBottom: 16,
  },
  policyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 12,
  },
  policyText: { fontSize: 15, color: "#52525B", flex: 1 },

  measurementsSection: {
    marginTop: 20,
  },
  measurementsHeader: {
    alignItems: 'center',
  },
  measurementsToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#8B4513',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    gap: 8,
  },
  measurementsToggleBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  measurementsContent: {
    marginTop: 12,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 16,
  },
  unitToggleContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 16,
    gap: 8,
    backgroundColor: '#f5f5f5',
    padding: 4,
    borderRadius: 20,
    alignSelf: 'center',
  },
  unitToggleBtn: {
    paddingVertical: 6,
    paddingHorizontal: 16,
    borderRadius: 16,
    backgroundColor: '#666',
  },
  unitToggleBtnActive: {
    backgroundColor: '#2196F3',
  },
  unitToggleBtnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '500',
  },
  unitToggleBtnTextActive: {
    fontWeight: '700',
  },
  measurementsList: {
    gap: 8,
  },
  measurementRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  measurementLabel: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  measurementValue: {
    fontSize: 14,
    color: '#1F2937',
    fontWeight: '700',
  },
});