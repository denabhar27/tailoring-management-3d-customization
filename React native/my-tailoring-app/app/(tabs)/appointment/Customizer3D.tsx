
import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ActivityIndicator,
  Text,
  Alert,
  BackHandler,
  StatusBar,
  TouchableOpacity,
  Platform,
  Linking,
  Share,
 Image, Modal, ScrollView, TextInput } from 'react-native';
import { WebView, WebViewMessageEvent } from 'react-native-webview';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

import DateTimePickerModal from '../../../components/DateTimePickerModal';
import { 
  uploadCustomizationImage, 
  addCustomizationToCart,
  convertBase64ToFormData 
} from '../../../utils/customizationService';

const WEB_3D_CUSTOMIZER_URL = process.env.EXPO_PUBLIC_WEB_3D_URL || 'http://192.168.254.102:5174/3d-customizer';

console.log('3D Customizer URL:', WEB_3D_CUSTOMIZER_URL);

interface CustomizationData {
  type: 'CUSTOMIZATION_COMPLETE' | 'CUSTOMIZATION_CANCEL' | 'CUSTOMIZATION_ERROR' | 'DESIGN_IMAGE_READY' | 'CONSOLE_LOG' | string;
  garmentType?: string;
  garmentCode?: string;
  fabricType?: string;
  designImage?: string; 
  angleImages?: { front?: string; back?: string; right?: string; left?: string }; 
  imageData?: string; 
  garmentName?: string;
  designData?: any;
  measurements?: any;
  notes?: string;
  estimatedPrice?: number;
  error?: string;
  message?: string;
}

const presetColors = [
  { name: 'Classic Black', value: '#1a1a1a' },
  { name: 'Navy Blue', value: '#1e3a5f' },
  { name: 'Burgundy', value: '#6b1e3d' },
  { name: 'Forest Green', value: '#2d5a3d' },
  { name: 'Charcoal Gray', value: '#4a4a4a' },
  { name: 'Camel Tan', value: '#c9a66b' },
  { name: 'Cream White', value: '#f5e6d3' },
  { name: 'Chocolate Brown', value: '#5D4037' },
  { name: 'Royal Blue', value: '#2a4d8f' },
  { name: 'Wine Red', value: '#722F37' },
];

const getColorName = (hex: string | undefined): string => {
  if (!hex) return 'Not specified';
  
  if (typeof hex === 'string' && !hex.startsWith('#') && !hex.match(/^[0-9a-fA-F]{3,6}$/)) {
    return hex.charAt(0).toUpperCase() + hex.slice(1);
  }
  
  let normalizedHex = String(hex).toLowerCase().trim();
  if (!normalizedHex.startsWith('#')) {
    normalizedHex = `#${normalizedHex}`;
  }
  
  const presetMatch = presetColors.find(color => color.value.toLowerCase() === normalizedHex);
  if (presetMatch) return presetMatch.name;
  
  return 'Custom Color';
};

const getButtonType = (modelPath: string | undefined): string => {
  if (!modelPath) return '';
  const buttonMap: { [key: string]: string } = {
    '/orange button 3d model.glb': 'Orange Button',
    '/four hole button 3d model (1).glb': 'Four Hole Button',
  };
  return buttonMap[modelPath] || modelPath.split('/').pop()?.replace('.glb', '').replace(/\d+/g, '').trim() || '';
};

const getAccessoryName = (modelPath: string | undefined): string => {
  if (!modelPath) return '';
  const accessoryMap: { [key: string]: string } = {
    '/accessories/gold lion pendant 3d model.glb': 'Pendant',
    '/accessories/flower brooch 3d model.glb': 'Brooch',
    '/accessories/fabric rose 3d model.glb': 'Flower',
  };
  return accessoryMap[modelPath] || modelPath.split('/').pop()?.replace('.glb', '').replace(/\d+/g, '').trim() || '';
};

const defaultFabricTypes: { [key: string]: number } = {
  'Cotton': 200,
  'Silk': 300,
  'Linen': 400,
  'Wool': 200
};

const defaultGarmentTypes: { [key: string]: number } = {
  'Suit': 5600,
  'Blazer': 5000,
  'Barong': 3500,
  'Pants': 1000
};

export default function Customizer3DScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const webViewRef = useRef<WebView>(null);
  
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [loadingTime, setLoadingTime] = useState(0);

  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [pendingCustomization, setPendingCustomization] = useState<CustomizationData | null>(null);
  const [preferredDate, setPreferredDate] = useState(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000));
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [notes, setNotes] = useState('');

  const [fabricTypes, setFabricTypes] = useState<{ [key: string]: number }>(defaultFabricTypes);
  const [garmentTypes, setGarmentTypes] = useState<{ [key: string]: number }>(defaultGarmentTypes);
  const [garmentCodeToName, setGarmentCodeToName] = useState<{ [key: string]: string }>({});
  const [selectedFabric, setSelectedFabric] = useState<string>('');
  const [selectedGarment, setSelectedGarment] = useState<string>('');
  const [estimatedPrice, setEstimatedPrice] = useState<number>(0);
  const [showFabricPicker, setShowFabricPicker] = useState(false);
  const [showGarmentPicker, setShowGarmentPicker] = useState(false);
  const [formErrors, setFormErrors] = useState<{ [key: string]: string }>({});

  useEffect(() => {
    if (showConfirmModal) {
      loadFabricTypes();
      loadGarmentTypes();
    }
  }, [showConfirmModal]);

  useEffect(() => {
    if (showConfirmModal && pendingCustomization && Object.keys(garmentCodeToName).length > 0) {
      
      if (pendingCustomization?.fabricType && !selectedFabric) {
        const fabricName = pendingCustomization.fabricType.charAt(0).toUpperCase() + pendingCustomization.fabricType.slice(1);
        setSelectedFabric(fabricName);
      }

      if (pendingCustomization?.garmentType && !selectedGarment) {
        const garmentCode = pendingCustomization.garmentCode || '';
        const garmentTypeName = pendingCustomization.garmentType || '';
        
        console.log('🎯 Trying to match garment:', { garmentCode, garmentTypeName });
        
        let mappedGarment = '';

        if (garmentCode && garmentCodeToName[garmentCode.toLowerCase()]) {
          mappedGarment = garmentCodeToName[garmentCode.toLowerCase()];
        }
        
        else if (garmentCode) {
          for (const [code, name] of Object.entries(garmentCodeToName)) {
            if (garmentCode.toLowerCase().includes(code) || code.includes(garmentCode.toLowerCase())) {
              mappedGarment = name;
              break;
            }
          }
        }
        
        if (!mappedGarment && garmentTypeName) {
          const garmentTypeLower = garmentTypeName.toLowerCase();
          if (garmentCodeToName[garmentTypeLower]) {
            mappedGarment = garmentCodeToName[garmentTypeLower];
          } else {
            for (const [code, name] of Object.entries(garmentCodeToName)) {
              const nameLower = name.toLowerCase();
              if (garmentTypeLower.includes(nameLower) || nameLower.includes(garmentTypeLower)) {
                mappedGarment = name;
                break;
              }
            }
          }
        }
        
        console.log('🎯 Mapped garment to:', mappedGarment || '(no match)');
        
        if (mappedGarment) {
          setSelectedGarment(mappedGarment);
        }
      }
    }
  }, [showConfirmModal, pendingCustomization, garmentCodeToName]);

  useEffect(() => {
    if (selectedFabric && selectedGarment) {
      const fabricPrice = fabricTypes[selectedFabric] || 0;
      const garmentPrice = garmentTypes[selectedGarment] || 0;
      setEstimatedPrice(fabricPrice + garmentPrice);
    } else {
      setEstimatedPrice(0);
    }
  }, [selectedFabric, selectedGarment, fabricTypes, garmentTypes]);

  const loadFabricTypes = async () => {
    try {
      const token = await AsyncStorage.getItem('userToken');
      const response = await fetch(`${process.env.EXPO_PUBLIC_API_BASE_URL || 'http://192.168.1.202:5000/api'}/fabric-types`, {
        headers: {
          'Authorization': token ? `Bearer ${token}` : '',
          'Content-Type': 'application/json',
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.fabrics && data.fabrics.length > 0) {
          const fabricTypesObj: { [key: string]: number } = { ...defaultFabricTypes };
          data.fabrics.forEach((fabric: { fabric_name: string; fabric_price: string }) => {
            fabricTypesObj[fabric.fabric_name] = parseFloat(fabric.fabric_price);
          });
          setFabricTypes(fabricTypesObj);
        }
      }
    } catch (error) {
      console.log('Error loading fabric types:', error);
      
    }
  };

  const loadGarmentTypes = async () => {
    try {
      const token = await AsyncStorage.getItem('userToken');
      const response = await fetch(`${process.env.EXPO_PUBLIC_API_BASE_URL || 'http://192.168.1.202:5000/api'}/garment-types`, {
        headers: {
          'Authorization': token ? `Bearer ${token}` : '',
          'Content-Type': 'application/json',
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.garments && data.garments.length > 0) {
          const garmentTypesObj: { [key: string]: number } = {};
          const codeToNameMap: { [key: string]: string } = {};
          
          data.garments.forEach((garment: { garment_name: string; garment_price: string; garment_code?: string }) => {
            garmentTypesObj[garment.garment_name] = parseFloat(garment.garment_price);
            
            if (garment.garment_code) {
              codeToNameMap[garment.garment_code.toLowerCase()] = garment.garment_name;
            }
            
            codeToNameMap[garment.garment_name.toLowerCase()] = garment.garment_name;
          });
          
          setGarmentTypes(garmentTypesObj);
          setGarmentCodeToName(codeToNameMap);
          console.log('✅ Loaded garment types:', garmentTypesObj);
          console.log('✅ Garment code mapping:', codeToNameMap);
        }
      }
    } catch (error) {
      console.log('Error loading garment types:', error);
      
    }
  };

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (isLoading && !loadError) {
      interval = setInterval(() => {
        setLoadingTime(prev => {
          if (prev >= 15) {
            setLoadError(`Connection timeout. Make sure the web app is running at:\n${WEB_3D_CUSTOMIZER_URL}`);
            setIsLoading(false);
            return prev;
          }
          return prev + 1;
        });
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isLoading, loadError]);

  useEffect(() => {
    const loadAuthData = async () => {
      try {
        const token = await AsyncStorage.getItem('userToken');
        const user = await AsyncStorage.getItem('userData');
        setAuthToken(token);
        if (user) {
          const userData = JSON.parse(user);
          setUserId(userData.id || userData.userId);
        }
      } catch (error) {
        console.error('Error loading auth data:', error);
      }
    };
    loadAuthData();
  }, []);

  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (webViewRef.current) {
        webViewRef.current.goBack();
        return true;
      }
      return false;
    });

    return () => backHandler.remove();
  }, []);

  const injectedJavaScript = `
    (function() {
      
      window.REACT_NATIVE_AUTH = {
        token: ${authToken ? `"${authToken}"` : 'null'},
        userId: ${userId ? `"${userId}"` : 'null'},
        platform: 'react-native',
        version: '1.0.0'
      };

      
      const originalLog = console.log;
      console.log = function(...args) {
        originalLog.apply(console, args);
        if (window.ReactNativeWebView) {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'CONSOLE_LOG',
            message: args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ')
          }));
        }
      };

      
      window.addEventListener('webglcontextlost', function(e) {
        e.preventDefault();
        console.log('WebGL context lost - attempting recovery...');
      }, false);

      window.addEventListener('webglcontextrestored', function(e) {
        console.log('WebGL context restored');
        
        if (window.location.reload) {
          setTimeout(() => {
            window.location.reload();
          }, 500);
        }
      }, false);

      
      const observeCanvases = () => {
        const canvases = document.querySelectorAll('canvas');
        canvases.forEach(canvas => {
          if (!canvas._contextLossHandled) {
            canvas._contextLossHandled = true;
            canvas.addEventListener('webglcontextlost', function(e) {
              e.preventDefault();
              console.log('Canvas WebGL context lost');
            }, false);
            canvas.addEventListener('webglcontextrestored', function() {
              console.log('Canvas WebGL context restored');
            }, false);
          }
        });
      };

      
      const observer = new MutationObserver(observeCanvases);
      observer.observe(document.body, { childList: true, subtree: true });
      setTimeout(observeCanvases, 1000);

      
      window.sendToReactNative = function(data) {
        if (window.ReactNativeWebView) {
          window.ReactNativeWebView.postMessage(JSON.stringify(data));
          return true;
        }
        return false;
      };

      
      window.IS_REACT_NATIVE_WEBVIEW = true;
      
      
      document.dispatchEvent(new CustomEvent('reactNativeReady', { 
        detail: window.REACT_NATIVE_AUTH 
      }));

      
      if (typeof window.initReactNativeMode === 'function') {
        window.initReactNativeMode(window.REACT_NATIVE_AUTH);
      }

      true; 
    })();
  `;

  const handleMessage = useCallback(async (event: WebViewMessageEvent) => {
    try {
      const data: CustomizationData = JSON.parse(event.nativeEvent.data);
      
      console.log('[Customizer3D] Received message from WebView:', data.type);
      console.log('[Customizer3D] Full data keys:', Object.keys(data));

      switch (data.type) {
        case 'CUSTOMIZATION_COMPLETE':
          await handleCustomizationComplete(data);
          break;
          
        case 'CUSTOMIZATION_CANCEL':
          handleCustomizationCancel();
          break;
          
        case 'CUSTOMIZATION_ERROR':
          Alert.alert('Error', data.error || 'An error occurred in the customizer');
          break;
          
        case 'DESIGN_IMAGE_READY':
          await handleSaveDesignImage(data);
          break;
          
        case 'CONSOLE_LOG':
          
          console.log('[WebView]:', data.message);
          break;
          
        default:
          console.log('Unknown message type:', data.type);
      }
    } catch (error) {
      console.error('Error parsing WebView message:', error);
    }
  }, []);

  const handleSaveDesignImage = async (data: CustomizationData) => {
    if (!data.imageData) {
      Alert.alert('Error', 'No image data received');
      return;
    }

    setIsSaving(true);

    try {
      
      const base64Data = data.imageData.replace(/^data:image\/\w+;base64,/, '');

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const garmentName = data.garmentName || 'custom-design';
      const filename = `${garmentName}-${timestamp}.png`;
      const fileUri = (FileSystem.cacheDirectory || '') + filename;

      await FileSystem.writeAsStringAsync(fileUri, base64Data, {
        encoding: FileSystem.EncodingType.Base64,
      });

      if (await Sharing.isAvailableAsync()) {
        
        await Sharing.shareAsync(fileUri, {
          mimeType: 'image/png',
          dialogTitle: 'Save or Share your design',
          UTI: 'public.png',
        });
        
        Alert.alert(
          '✅ Design Ready!',
          'Use the share menu to save to your gallery or share with others.',
          [{ text: 'OK' }]
        );
      } else {
        Alert.alert(
          'Sharing Not Available',
          'Sharing is not available on this device.',
          [{ text: 'OK' }]
        );
      }

      setTimeout(async () => {
        try {
          await FileSystem.deleteAsync(fileUri, { idempotent: true });
        } catch (e) {
          
        }
      }, 5000);

    } catch (error: any) {
      console.error('Error saving design image:', error);
      Alert.alert(
        'Save Failed',
        error.message || 'Failed to save the design image. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleCustomizationComplete = async (data: CustomizationData) => {
    console.log('[Customizer3D] handleCustomizationComplete received data:', JSON.stringify(data, null, 2));
    console.log('[Customizer3D] angleImages:', data.angleImages);
    console.log('[Customizer3D] designImage:', data.designImage ? 'present' : 'missing');
    console.log('[Customizer3D] designData:', data.designData);
    
    setPendingCustomization(data);
    setNotes(data.notes || '');
    setPreferredDate(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000));
    setShowConfirmModal(true);
  };

  const handleDateConfirm = (selectedDate: Date) => {
    setPreferredDate(selectedDate);
    setShowDatePicker(false);
  };

  const handleDateCancel = () => {
    setShowDatePicker(false);
  };

  const handleAddToCartFromModal = async () => {
    if (!pendingCustomization) return;

    const errors: { [key: string]: string } = {};
    if (!selectedFabric) {
      errors.fabric = 'Please select a fabric type';
    }
    if (!selectedGarment) {
      errors.garment = 'Please select a garment type';
    }
    
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }
    setFormErrors({});

    setIsSaving(true);
    setShowConfirmModal(false);
    
    try {
      let imageUrl = 'no-image';

      if (pendingCustomization.designImage) {
        let tempFileUri: string | null = null;
        try {
          const { formData, fileUri } = await convertBase64ToFormData(pendingCustomization.designImage, 'custom-design.png');
          tempFileUri = fileUri;
          
          const uploadResponse = await uploadCustomizationImage(formData);
          imageUrl = uploadResponse.imageUrl || uploadResponse.data?.imageUrl || imageUrl;

          if (tempFileUri) {
            try {
              await FileSystem.deleteAsync(tempFileUri, { idempotent: true });
            } catch (cleanupError) {
              
              console.log('Cleanup error (non-critical):', cleanupError);
            }
          }
        } catch (uploadError) {
          console.error('Image upload failed:', uploadError);
          
          if (tempFileUri) {
            try {
              await FileSystem.deleteAsync(tempFileUri, { idempotent: true });
            } catch (e) {
              
            }
          }
          
        }
      }

      const designDataWithAngleImages = {
        ...(pendingCustomization.designData || {}),
        angleImages: pendingCustomization.angleImages,
      };
      
      // Format date in local timezone to avoid UTC conversion issues
      const year = preferredDate.getFullYear();
      const month = String(preferredDate.getMonth() + 1).padStart(2, '0');
      const day = String(preferredDate.getDate()).padStart(2, '0');
      const dateStr = `${year}-${month}-${day}`;
      
      const cartResponse = await addCustomizationToCart({
        garmentType: selectedGarment,
        fabricType: selectedFabric,
        preferredDate: dateStr,
        notes: notes || pendingCustomization.notes || '',
        imageUrl: imageUrl,
        designData: designDataWithAngleImages,
        estimatedPrice: estimatedPrice || pendingCustomization.estimatedPrice || 500,
      });
      
      Alert.alert(
        'Success!',
        'Your custom design has been added to cart.',
        [
          {
            text: 'View Cart',
            onPress: () => router.push('/(tabs)/cart/Cart'),
          },
          {
            text: 'Continue Shopping',
            onPress: () => router.back(),
          },
        ]
      );
    } catch (error: any) {
      console.error('Error saving customization:', error);
      Alert.alert(
        'Save Failed',
        error.message || 'Failed to save your customization. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setIsSaving(false);
      setPendingCustomization(null);
      
      setSelectedFabric('');
      setSelectedGarment('');
      setNotes('');
      setFormErrors({});
    }
  };

  const handleCloseModal = () => {
    setShowConfirmModal(false);
    setPendingCustomization(null);
    setSelectedFabric('');
    setSelectedGarment('');
    setNotes('');
    setFormErrors({});
  };

  const handleCustomizationCancel = () => {
    Alert.alert(
      'Discard Changes?',
      'Are you sure you want to leave? Your customization will not be saved.',
      [
        { text: 'Stay', style: 'cancel' },
        { text: 'Leave', style: 'destructive', onPress: () => router.back() },
      ]
    );
  };

  const handleLoadEnd = () => {
    setIsLoading(false);
    setLoadError(null);
  };

  const handleError = (syntheticEvent: any) => {
    const { nativeEvent } = syntheticEvent;
    console.error('WebView error:', nativeEvent);
    setLoadError(nativeEvent.description || 'Failed to load 3D customizer');
    setIsLoading(false);
  };

  const handleHttpError = (syntheticEvent: any) => {
    const { nativeEvent } = syntheticEvent;
    console.error('HTTP error:', nativeEvent);
    if (nativeEvent.statusCode >= 400) {
      setLoadError(`Server error: ${nativeEvent.statusCode}`);
    }
  };

  const handleRetry = () => {
    setLoadError(null);
    setIsLoading(true);
    setLoadingTime(0);
    webViewRef.current?.reload();
  };

  const handleOpenInBrowser = async () => {
    try {
      await Linking.openURL(WEB_3D_CUSTOMIZER_URL);
    } catch (error) {
      Alert.alert('Error', 'Could not open browser');
    }
  };

  const handleGoBack = () => {
    router.back();
  };

  if (loadError) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={handleGoBack} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#5D4037" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>3D Customizer</Text>
          <View style={styles.placeholder} />
        </View>
        
        <View style={styles.errorContainer}>
          <Ionicons name="cloud-offline-outline" size={80} color="#5D4037" />
          <Text style={styles.errorTitle}>Connection Error</Text>
          <Text style={styles.errorText}>{loadError}</Text>
          <Text style={styles.urlText}>URL: {WEB_3D_CUSTOMIZER_URL}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={handleRetry}>
            <Text style={styles.retryButtonText}>Try Again</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.browserButton} onPress={handleOpenInBrowser}>
            <Ionicons name="open-outline" size={18} color="#5D4037" />
            <Text style={styles.browserButtonText}>Open in Browser</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.cancelButton} onPress={handleGoBack}>
            <Text style={styles.cancelButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFF8F0" />
      <View style={styles.header}>
        <TouchableOpacity onPress={handleGoBack} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#5D4037" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>3D Customizer</Text>
        <TouchableOpacity 
          onPress={() => webViewRef.current?.reload()} 
          style={styles.refreshButton}
        >
          <Ionicons name="refresh" size={22} color="#5D4037" />
        </TouchableOpacity>
      </View>
      <WebView
        ref={webViewRef}
        source={{ uri: WEB_3D_CUSTOMIZER_URL }}
        style={styles.webview}
        onLoadEnd={handleLoadEnd}
        onError={handleError}
        onHttpError={handleHttpError}
        onMessage={handleMessage}
        injectedJavaScript={injectedJavaScript}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        allowsInlineMediaPlayback={true}
        mediaPlaybackRequiresUserAction={false}
        allowsFullscreenVideo={true}
        mixedContentMode="compatibility"
        originWhitelist={['*']}
        allowFileAccess={true}
        startInLoadingState={false}
        scalesPageToFit={true}
        showsHorizontalScrollIndicator={false}
        showsVerticalScrollIndicator={false}
        cacheEnabled={true}
        thirdPartyCookiesEnabled={true}
        sharedCookiesEnabled={true}
        onContentProcessDidTerminate={() => {
          webViewRef.current?.reload();
        }}
        userAgent={Platform.select({
          ios: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1 ReactNativeWebView',
          android: 'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36 ReactNativeWebView',
        })}
      />
      {(isLoading || isSaving) && (
        <View style={styles.loadingOverlay}>
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color="#5D4037" />
            <Text style={styles.loadingText}>
              {isSaving ? 'Saving your design...' : 'Loading 3D Customizer...'}
            </Text>
            {!isSaving && (
              <>
                <Text style={styles.loadingSubtext}>
                  {loadingTime > 0 ? `${loadingTime}s - This may take a moment` : 'Connecting...'}
                </Text>
                <Text style={styles.loadingUrl} numberOfLines={2}>
                  {WEB_3D_CUSTOMIZER_URL}
                </Text>
              </>
            )}
          </View>
        </View>
      )}
      <Modal
        visible={showConfirmModal}
        animationType="slide"
        transparent={true}
        onRequestClose={handleCloseModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>🧥 Customization Service</Text>
                <TouchableOpacity
                  onPress={handleCloseModal}
                  style={styles.closeButton}
                >
                  <Ionicons name="close" size={24} color="#5D4037" />
                </TouchableOpacity>
              </View>
              {pendingCustomization?.angleImages ? (
                <View style={styles.imageSection}>
                  <Text style={styles.sectionLabel}>📷 Your 3D Design</Text>
                  <View style={styles.angleImagesGrid}>
                    {['front', 'back', 'right', 'left'].map((angle) => {
                      const angleKey = angle as keyof typeof pendingCustomization.angleImages;
                      const imageUri = pendingCustomization.angleImages?.[angleKey];
                      if (!imageUri) return null;
                      return (
                        <View key={angle} style={styles.angleImageContainer}>
                          <Image
                            source={{ uri: imageUri }}
                            style={styles.angleImage}
                            resizeMode="contain"
                          />
                          <View style={styles.angleLabel}>
                            <Text style={styles.angleLabelText}>{angle.charAt(0).toUpperCase() + angle.slice(1)}</Text>
                          </View>
                        </View>
                      );
                    })}
                  </View>
                </View>
              ) : pendingCustomization?.designImage && (
                <View style={styles.imageSection}>
                  <Text style={styles.sectionLabel}>📷 Your 3D Design</Text>
                  <Image
                    source={{ uri: pendingCustomization.designImage }}
                    style={styles.designImage}
                    resizeMode="contain"
                  />
                </View>
              )}
              <View style={styles.formSection}>
                <Text style={styles.sectionLabel}>
                  🧵 Fabric Type <Text style={styles.required}>*</Text>
                </Text>
                <TouchableOpacity
                  style={[styles.dropdownButton, formErrors.fabric && styles.dropdownError]}
                  onPress={() => setShowFabricPicker(!showFabricPicker)}
                >
                  <Text style={selectedFabric ? styles.dropdownText : styles.dropdownPlaceholder}>
                    {selectedFabric ? `${selectedFabric} - ₱${fabricTypes[selectedFabric]}` : '-- Select Fabric Type --'}
                  </Text>
                  <Ionicons name={showFabricPicker ? "chevron-up" : "chevron-down"} size={20} color="#8D6E63" />
                </TouchableOpacity>
                {showFabricPicker && (
                  <View style={styles.dropdownOptions}>
                    {Object.keys(fabricTypes).sort().map((fabric) => (
                      <TouchableOpacity
                        key={fabric}
                        style={[styles.dropdownOption, selectedFabric === fabric && styles.dropdownOptionSelected]}
                        onPress={() => {
                          setSelectedFabric(fabric);
                          setShowFabricPicker(false);
                          setFormErrors(prev => ({ ...prev, fabric: '' }));
                        }}
                      >
                        <Text style={[styles.dropdownOptionText, selectedFabric === fabric && styles.dropdownOptionTextSelected]}>
                          {fabric} - ₱{fabricTypes[fabric].toFixed(2)}
                        </Text>
                        {selectedFabric === fabric && <Ionicons name="checkmark" size={18} color="#5D4037" />}
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
                {formErrors.fabric && <Text style={styles.errorText}>{formErrors.fabric}</Text>}
              </View>
              <View style={styles.formSection}>
                <Text style={styles.sectionLabel}>
                  👔 Garment Type <Text style={styles.required}>*</Text>
                </Text>
                <TouchableOpacity
                  style={[styles.dropdownButton, formErrors.garment && styles.dropdownError]}
                  onPress={() => setShowGarmentPicker(!showGarmentPicker)}
                >
                  <Text style={selectedGarment ? styles.dropdownText : styles.dropdownPlaceholder}>
                    {selectedGarment ? `${selectedGarment} - ₱${garmentTypes[selectedGarment]}` : '-- Select Garment Type --'}
                  </Text>
                  <Ionicons name={showGarmentPicker ? "chevron-up" : "chevron-down"} size={20} color="#8D6E63" />
                </TouchableOpacity>
                {showGarmentPicker && (
                  <View style={styles.dropdownOptions}>
                    {Object.keys(garmentTypes).map((garment) => (
                      <TouchableOpacity
                        key={garment}
                        style={[styles.dropdownOption, selectedGarment === garment && styles.dropdownOptionSelected]}
                        onPress={() => {
                          setSelectedGarment(garment);
                          setShowGarmentPicker(false);
                          setFormErrors(prev => ({ ...prev, garment: '' }));
                        }}
                      >
                        <Text style={[styles.dropdownOptionText, selectedGarment === garment && styles.dropdownOptionTextSelected]}>
                          {garment} - ₱{garmentTypes[garment]}
                        </Text>
                        {selectedGarment === garment && <Ionicons name="checkmark" size={18} color="#5D4037" />}
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
                {formErrors.garment && <Text style={styles.errorText}>{formErrors.garment}</Text>}
              </View>
              <View style={styles.formSection}>
                <Text style={styles.sectionLabel}>
                  📅 Preferred Date for Sizing in Store <Text style={styles.required}>*</Text>
                </Text>
                <TouchableOpacity
                  style={styles.datePickerButton}
                  onPress={() => setShowDatePicker(true)}
                >
                  <Ionicons name="calendar-outline" size={20} color="#5D4037" />
                  <Text style={styles.datePickerText}>
                    {preferredDate.toLocaleDateString('en-US', {
                      weekday: 'short',
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </Text>
                  <Ionicons name="chevron-forward" size={20} color="#8D6E63" />
                </TouchableOpacity>
              </View>
              {pendingCustomization?.designData && (
                <View style={styles.customizationChoicesSection}>
                  <Text style={styles.customizationChoicesTitle}>🎨 3D Customization Choices</Text>
                  <View style={styles.customizationChoicesGrid}>
                    {pendingCustomization.designData.size && (
                      <View style={styles.choiceItem}>
                        <Text style={styles.choiceLabel}>Size:</Text>
                        <Text style={styles.choiceValue}>
                          {String(pendingCustomization.designData.size).charAt(0).toUpperCase() + String(pendingCustomization.designData.size).slice(1)}
                        </Text>
                      </View>
                    )}
                    {pendingCustomization.designData.fit && (
                      <View style={styles.choiceItem}>
                        <Text style={styles.choiceLabel}>Fit:</Text>
                        <Text style={styles.choiceValue}>
                          {String(pendingCustomization.designData.fit).charAt(0).toUpperCase() + String(pendingCustomization.designData.fit).slice(1)}
                        </Text>
                      </View>
                    )}
                    {pendingCustomization.designData.colors?.fabric && (
                      <View style={styles.choiceItem}>
                        <Text style={styles.choiceLabel}>Color:</Text>
                        <View style={styles.colorChoice}>
                          <View style={[styles.colorSwatch, { backgroundColor: pendingCustomization.designData.colors.fabric }]} />
                          <Text style={styles.choiceValue}>{getColorName(pendingCustomization.designData.colors.fabric)}</Text>
                        </View>
                      </View>
                    )}
                    {pendingCustomization.designData.pattern && pendingCustomization.designData.pattern !== 'none' && (
                      <View style={styles.choiceItem}>
                        <Text style={styles.choiceLabel}>Pattern:</Text>
                        <Text style={styles.choiceValue}>
                          {String(pendingCustomization.designData.pattern).charAt(0).toUpperCase() + String(pendingCustomization.designData.pattern).slice(1).replace('-', ' ')}
                        </Text>
                      </View>
                    )}
                    {pendingCustomization.designData.personalization?.initials && (
                      <View style={[styles.choiceItem, styles.choiceItemFull]}>
                        <Text style={styles.choiceLabel}>Personalization:</Text>
                        <Text style={styles.choiceValue}>
                          {pendingCustomization.designData.personalization.initials}
                          {pendingCustomization.designData.personalization.font && ` (${pendingCustomization.designData.personalization.font} font)`}
                        </Text>
                      </View>
                    )}
                    {pendingCustomization.designData.buttons && pendingCustomization.designData.buttons.length > 0 && (
                      <View style={[styles.choiceItem, styles.choiceItemFull]}>
                        <Text style={styles.choiceLabel}>Buttons:</Text>
                        <View>
                          {pendingCustomization.designData.buttons.map((btn: any, index: number) => (
                            <Text key={btn.id || index} style={styles.choiceValue}>
                              Button {index + 1}: {getButtonType(btn.modelPath)}
                            </Text>
                          ))}
                        </View>
                      </View>
                    )}
                    {pendingCustomization.designData.accessories && pendingCustomization.designData.accessories.length > 0 && (
                      <View style={[styles.choiceItem, styles.choiceItemFull]}>
                        <Text style={styles.choiceLabel}>Accessories:</Text>
                        <View>
                          {pendingCustomization.designData.accessories.map((acc: any, index: number) => (
                            <Text key={acc.id || index} style={styles.choiceValue}>
                              {getAccessoryName(acc.modelPath)}
                            </Text>
                          ))}
                        </View>
                      </View>
                    )}
                  </View>
                </View>
              )}
              <View style={styles.formSection}>
                <Text style={styles.sectionLabel}>📝 Additional Notes</Text>
                <TextInput
                  style={styles.notesInput}
                  placeholder="Add any special requests or notes..."
                  placeholderTextColor="#8D6E63"
                  multiline
                  numberOfLines={4}
                  value={notes}
                  onChangeText={setNotes}
                  textAlignVertical="top"
                />
              </View>
              {estimatedPrice > 0 && selectedFabric && selectedGarment && (
                <View style={styles.priceEstimateSection}>
                  <Text style={styles.priceEstimateTitle}>Estimated Price: ₱{estimatedPrice.toLocaleString()}</Text>
                  <Text style={styles.priceBreakdown}>
                    Fabric: {selectedFabric} (₱{fabricTypes[selectedFabric]}) + Garment: {selectedGarment} (₱{garmentTypes[selectedGarment]})
                  </Text>
                  <Text style={styles.priceNote}>
                    Note: Estimated price is based on the selected garment and fabric type. Final price may vary depending on sizes and other accessories.
                  </Text>
                </View>
              )}
              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={styles.modalCancelButton}
                  onPress={handleCloseModal}
                >
                  <Text style={styles.modalCancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.confirmButton}
                  onPress={handleAddToCartFromModal}
                  disabled={isSaving}
                >
                  {isSaving ? (
                    <ActivityIndicator color="#FFF" />
                  ) : (
                    <>
                      <Text style={styles.confirmButtonText}>🛒 Add to Cart</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
        <DateTimePickerModal
          visible={showDatePicker}
          mode="date"
          value={preferredDate}
          minimumDate={new Date()}
          onConfirm={handleDateConfirm}
          onCancel={handleDateCancel}
        />
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF8F0',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFF8F0',
    borderBottomWidth: 1,
    borderBottomColor: '#E8D5C4',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#5D4037',
    fontFamily: Platform.OS === 'ios' ? 'Poppins-SemiBold' : 'sans-serif-medium',
  },
  backButton: {
    padding: 8,
    borderRadius: 8,
  },
  refreshButton: {
    padding: 8,
    borderRadius: 8,
  },
  placeholder: {
    width: 40,
  },
  webview: {
    flex: 1,
    backgroundColor: '#FFF8F0',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 248, 240, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingBox: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 40,
    paddingVertical: 30,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#5D4037',
    fontWeight: '500',
  },
  loadingSubtext: {
    marginTop: 4,
    fontSize: 13,
    color: '#8D6E63',
  },
  loadingUrl: {
    marginTop: 8,
    fontSize: 11,
    color: '#AAA',
    textAlign: 'center',
    maxWidth: 250,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  errorTitle: {
    fontSize: 22,
    fontWeight: '600',
    color: '#5D4037',
    marginTop: 16,
    marginBottom: 8,
  },
  errorTextWebview: {
    fontSize: 15,
    color: '#8D6E63',
    textAlign: 'center',
    marginBottom: 12,
    lineHeight: 22,
  },
  urlText: {
    fontSize: 11,
    color: '#AAA',
    textAlign: 'center',
    marginBottom: 20,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  retryButton: {
    backgroundColor: '#5D4037',
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 25,
    marginBottom: 12,
    minWidth: 160,
    alignItems: 'center',
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  browserButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 25,
    backgroundColor: '#FFF8E7',
    borderWidth: 1,
    borderColor: '#B8860B',
    minWidth: 160,
    justifyContent: 'center',
    gap: 8,
    marginBottom: 12,
  },
  browserButtonText: {
    color: '#5D4037',
    fontSize: 16,
    fontWeight: '500',
  },
  cancelButton: {
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 25,
    borderWidth: 1,
    borderColor: '#5D4037',
    minWidth: 160,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#5D4037',
    fontSize: 16,
    fontWeight: '500',
  },
  
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFF8F0',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
    paddingBottom: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E8D5C4',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#5D4037',
  },
  closeButton: {
    padding: 4,
  },
  imageSection: {
    padding: 20,
    alignItems: 'center',
  },
  sectionLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#5D4037',
    marginBottom: 12,
    alignSelf: 'flex-start',
  },
  designImage: {
    width: '100%',
    height: 300,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
  },
  detailsSection: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    marginHorizontal: 20,
    marginBottom: 16,
    borderRadius: 12,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  detailLabel: {
    fontSize: 14,
    color: '#8D6E63',
    fontWeight: '500',
  },
  detailValue: {
    fontSize: 14,
    color: '#5D4037',
    fontWeight: '600',
  },
  dateSection: {
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  datePickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E8D5C4',
  },
  datePickerText: {
    flex: 1,
    marginLeft: 12,
    fontSize: 16,
    color: '#5D4037',
  },
  notesSection: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  notesInput: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E8D5C4',
    fontSize: 14,
    color: '#5D4037',
    minHeight: 100,
    marginTop: 8,
  },
  modalActions: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 12,
  },
  modalCancelButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 12,
    backgroundColor: '#F5F5F5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#8D6E63',
  },
  confirmButton: {
    flex: 2,
    paddingVertical: 16,
    borderRadius: 12,
    backgroundColor: '#5D4037',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  confirmButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  
  angleImagesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 10,
  },
  angleImageContainer: {
    width: '48%',
    aspectRatio: 1,
    position: 'relative',
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#E8D5C4',
    backgroundColor: '#FFF',
    marginBottom: 10,
  },
  angleImage: {
    width: '100%',
    height: '100%',
  },
  angleLabel: {
    position: 'absolute',
    bottom: 5,
    left: 5,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  angleLabelText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
    textTransform: 'capitalize',
  },
  
  formSection: {
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  required: {
    color: '#D32F2F',
    fontSize: 14,
  },
  dropdownButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E8D5C4',
  },
  dropdownError: {
    borderColor: '#D32F2F',
  },
  dropdownText: {
    fontSize: 16,
    color: '#5D4037',
    flex: 1,
  },
  dropdownPlaceholder: {
    fontSize: 16,
    color: '#8D6E63',
    flex: 1,
  },
  dropdownOptions: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E8D5C4',
    marginTop: 8,
    maxHeight: 200,
    overflow: 'hidden',
  },
  dropdownOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F0E6DD',
  },
  dropdownOptionSelected: {
    backgroundColor: '#FFF8F0',
  },
  dropdownOptionText: {
    fontSize: 15,
    color: '#5D4037',
  },
  dropdownOptionTextSelected: {
    fontWeight: '600',
  },
  errorText: {
    color: '#D32F2F',
    fontSize: 12,
    marginTop: 4,
    marginLeft: 4,
  },
  
  customizationChoicesSection: {
    marginHorizontal: 20,
    marginBottom: 16,
    backgroundColor: '#F8F9FA',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E8D5C4',
  },
  customizationChoicesTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  customizationChoicesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  choiceItem: {
    width: '50%',
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  choiceItemFull: {
    width: '100%',
  },
  choiceLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#5D4037',
    marginRight: 6,
  },
  choiceValue: {
    fontSize: 13,
    color: '#666',
    flex: 1,
  },
  colorChoice: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  colorSwatch: {
    width: 16,
    height: 16,
    borderRadius: 4,
    marginRight: 6,
    borderWidth: 1,
    borderColor: '#E8D5C4',
  },
  
  priceEstimateSection: {
    marginHorizontal: 20,
    marginBottom: 16,
    backgroundColor: '#E8F5E9',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#C8E6C9',
  },
  priceEstimateTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#2E7D32',
    marginBottom: 8,
  },
  priceBreakdown: {
    fontSize: 13,
    color: '#388E3C',
    marginBottom: 8,
  },
  priceNote: {
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic',
    lineHeight: 18,
  },
});
