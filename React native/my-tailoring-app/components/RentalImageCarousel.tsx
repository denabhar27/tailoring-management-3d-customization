import React, { useState } from "react";
import {
  View,
  Image,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  ScrollView,
  Modal,
  TouchableWithoutFeedback,
  Platform,
} from "react-native";
import { Text } from "react-native-paper";
import { Ionicons } from "@expo/vector-icons";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

interface RentalImage {
  url: string | null;
  label: string;
}

interface RentalImageCarouselProps {
  images: RentalImage[];
  itemName?: string;
  fallbackImage?: any;
  imageHeight?: number;
  showFullscreen?: boolean;
}

export default function RentalImageCarousel({
  images,
  itemName = "Rental Item",
  fallbackImage,
  imageHeight = 380,
  showFullscreen = true,
}: RentalImageCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showFullImage, setShowFullImage] = useState(false);

  const validImages = images.filter(
    (img) => img.url && img.url.trim() !== "" && img.url !== "no-image"
  );

  if (validImages.length === 0) {
    return (
      <View style={[styles.container, { height: imageHeight }]}>
        {fallbackImage ? (
          <Image
            source={fallbackImage}
            style={[styles.mainImage, { height: imageHeight }]}
            resizeMode="cover"
          />
        ) : (
          <View
            style={[
              styles.mainImage,
              { height: imageHeight, justifyContent: "center", alignItems: "center", backgroundColor: "#f0f0f0" },
            ]}
          >
            <Ionicons name="shirt-outline" size={60} color="#D1D5DB" />
            <Text style={{ color: "#9CA3AF", marginTop: 8 }}>No image available</Text>
          </View>
        )}
      </View>
    );
  }

  // Only one image
  if (validImages.length === 1) {
    return (
      <View style={styles.container}>
        <TouchableOpacity
          activeOpacity={0.95}
          onPress={() => showFullscreen && setShowFullImage(true)}
        >
          <Image
            source={{ uri: validImages[0].url! }}
            style={[styles.mainImage, { height: imageHeight }]}
            resizeMode="cover"
          />
          <View style={styles.labelBadge}>
            <Text style={styles.labelText}>{validImages[0].label}</Text>
          </View>
          {showFullscreen && (
            <View style={styles.tapToZoomOverlay}>
              <Ionicons name="expand-outline" size={24} color="#fff" />
              <Text style={styles.tapToZoomText}>Tap to zoom</Text>
            </View>
          )}
        </TouchableOpacity>

        {/* Fullscreen modal */}
        {showFullscreen && (
          <Modal visible={showFullImage} transparent animationType="fade">
            <TouchableWithoutFeedback onPress={() => setShowFullImage(false)}>
              <View style={styles.fullImageOverlay}>
                <TouchableOpacity
                  style={styles.closeBtn}
                  onPress={() => setShowFullImage(false)}
                >
                  <Ionicons name="close" size={30} color="#fff" />
                </TouchableOpacity>
                <Image
                  source={{ uri: validImages[0].url! }}
                  style={styles.fullImage}
                  resizeMode="contain"
                />
              </View>
            </TouchableWithoutFeedback>
          </Modal>
        )}
      </View>
    );
  }

  const goToPrev = () =>
    setCurrentIndex((prev) =>
      prev === 0 ? validImages.length - 1 : prev - 1
    );
  const goToNext = () =>
    setCurrentIndex((prev) =>
      prev === validImages.length - 1 ? 0 : prev + 1
    );

  return (
    <View style={styles.container}>

      <TouchableOpacity
        activeOpacity={0.95}
        onPress={() => showFullscreen && setShowFullImage(true)}
      >
        <Image
          source={{ uri: validImages[currentIndex].url! }}
          style={[styles.mainImage, { height: imageHeight }]}
          resizeMode="cover"
        />
        {/* Label badge */}
        <View style={styles.labelBadge}>
          <Text style={styles.labelText}>{validImages[currentIndex].label}</Text>
        </View>

        <View style={styles.counterBadge}>
          <Text style={styles.counterText}>
            {currentIndex + 1}/{validImages.length}
          </Text>
        </View>
      </TouchableOpacity>

      <TouchableOpacity style={styles.arrowLeft} onPress={goToPrev}>
        <Ionicons name="chevron-back" size={24} color="#fff" />
      </TouchableOpacity>
      <TouchableOpacity style={styles.arrowRight} onPress={goToNext}>
        <Ionicons name="chevron-forward" size={24} color="#fff" />
      </TouchableOpacity>

      {/* Thumbnails */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.thumbnailContainer}
      >
        {validImages.map((img, index) => (
          <TouchableOpacity
            key={index}
            onPress={() => setCurrentIndex(index)}
            style={[
              styles.thumbnail,
              index === currentIndex && styles.thumbnailActive,
            ]}
          >
            <Image
              source={{ uri: img.url! }}
              style={styles.thumbnailImage}
              resizeMode="cover"
            />
            <Text
              style={[
                styles.thumbnailLabel,
                index === currentIndex && styles.thumbnailLabelActive,
              ]}
              numberOfLines={1}
            >
              {img.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {showFullscreen && (
        <Modal visible={showFullImage} transparent animationType="fade">
          <View style={styles.fullImageOverlay}>
            <TouchableOpacity
              style={styles.closeBtn}
              onPress={() => setShowFullImage(false)}
            >
              <Ionicons name="close" size={30} color="#fff" />
            </TouchableOpacity>

            <Image
              source={{ uri: validImages[currentIndex].url! }}
              style={styles.fullImage}
              resizeMode="contain"
            />

            <View style={styles.fullscreenLabel}>
              <Text style={styles.fullscreenLabelText}>
                {validImages[currentIndex].label} ({currentIndex + 1}/
                {validImages.length})
              </Text>
            </View>

            {/* Fullscreen navigation */}
            <TouchableOpacity style={styles.fullArrowLeft} onPress={goToPrev}>
              <Ionicons name="chevron-back" size={32} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.fullArrowRight} onPress={goToNext}>
              <Ionicons name="chevron-forward" size={32} color="#fff" />
            </TouchableOpacity>

            {/* Fullscreen thumbnails */}
            <View style={styles.fullThumbnailRow}>
              {validImages.map((img, index) => (
                <TouchableOpacity
                  key={index}
                  onPress={() => setCurrentIndex(index)}
                  style={[
                    styles.fullThumbnail,
                    index === currentIndex && styles.fullThumbnailActive,
                  ]}
                >
                  <Image
                    source={{ uri: img.url! }}
                    style={styles.fullThumbnailImage}
                    resizeMode="cover"
                  />
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "relative",
  },
  mainImage: {
    width: "100%",
    borderRadius: 0,
  },
  labelBadge: {
    position: "absolute",
    top: 12,
    left: 12,
    backgroundColor: "rgba(0,0,0,0.6)",
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14,
  },
  labelText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
  },
  counterBadge: {
    position: "absolute",
    top: 12,
    right: 12,
    backgroundColor: "rgba(0,0,0,0.6)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  counterText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "600",
  },
  tapToZoomOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  tapToZoomText: {
    color: "#fff",
    marginTop: 6,
    fontSize: 13,
    fontWeight: "600",
    textShadowColor: "rgba(0,0,0,0.6)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  arrowLeft: {
    position: "absolute",
    left: 10,
    top: "40%",
    backgroundColor: "rgba(0,0,0,0.45)",
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  arrowRight: {
    position: "absolute",
    right: 10,
    top: "40%",
    backgroundColor: "rgba(0,0,0,0.45)",
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  thumbnailContainer: {
    flexDirection: "row",
    justifyContent: "center",
    paddingVertical: 10,
    paddingHorizontal: 16,
    gap: 10,
  },
  thumbnail: {
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#ddd",
    borderRadius: 8,
    overflow: "hidden",
    opacity: 0.6,
  },
  thumbnailActive: {
    borderColor: "#8B4513",
    opacity: 1,
  },
  thumbnailImage: {
    width: 58,
    height: 58,
  },
  thumbnailLabel: {
    fontSize: 9,
    color: "#888",
    paddingVertical: 3,
    fontWeight: "500",
  },
  thumbnailLabelActive: {
    color: "#8B4513",
    fontWeight: "700",
  },

  fullImageOverlay: {
    flex: 1,
    backgroundColor: "#000",
    justifyContent: "center",
    alignItems: "center",
  },
  closeBtn: {
    position: "absolute",
    top: Platform.OS === "ios" ? 60 : 30,
    left: 20,
    zIndex: 10,
    backgroundColor: "rgba(0,0,0,0.5)",
    padding: 12,
    borderRadius: 30,
  },
  fullImage: {
    width: "100%",
    height: "70%",
  },
  fullscreenLabel: {
    position: "absolute",
    top: Platform.OS === "ios" ? 65 : 35,
    alignSelf: "center",
    backgroundColor: "rgba(0,0,0,0.6)",
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 16,
  },
  fullscreenLabelText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  fullArrowLeft: {
    position: "absolute",
    left: 12,
    top: "48%",
    backgroundColor: "rgba(255,255,255,0.2)",
    width: 46,
    height: 46,
    borderRadius: 23,
    justifyContent: "center",
    alignItems: "center",
  },
  fullArrowRight: {
    position: "absolute",
    right: 12,
    top: "48%",
    backgroundColor: "rgba(255,255,255,0.2)",
    width: 46,
    height: 46,
    borderRadius: 23,
    justifyContent: "center",
    alignItems: "center",
  },
  fullThumbnailRow: {
    position: "absolute",
    bottom: Platform.OS === "ios" ? 50 : 30,
    flexDirection: "row",
    justifyContent: "center",
    width: "100%",
    gap: 10,
  },
  fullThumbnail: {
    width: 55,
    height: 55,
    borderRadius: 6,
    overflow: "hidden",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.3)",
    opacity: 0.5,
  },
  fullThumbnailActive: {
    borderColor: "#fff",
    opacity: 1,
  },
  fullThumbnailImage: {
    width: "100%",
    height: "100%",
  },
});
