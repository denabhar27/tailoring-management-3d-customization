import React, { useEffect } from "react";
import {
  View,
  StyleSheet,
  Dimensions,
  Image,
} from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  withSequence,
  withRepeat,
  withSpring,
  interpolate,
  Easing,
  runOnJS,
  FadeOut,
} from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";

const { width, height } = Dimensions.get("window");

interface SplashScreenProps {
  onFinish: () => void;
}

// ─── Animated Needle component ───────────────────────────────────
function AnimatedNeedle() {
  const needleY = useSharedValue(0);
  const needleRotate = useSharedValue(0);
  const opacity = useSharedValue(0);

  useEffect(() => {
    opacity.value = withDelay(800, withTiming(1, { duration: 500 }));
    needleY.value = withDelay(
      1000,
      withRepeat(
        withSequence(
          withTiming(-12, { duration: 600, easing: Easing.inOut(Easing.ease) }),
          withTiming(12, { duration: 600, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        true
      )
    );
    needleRotate.value = withDelay(
      1000,
      withRepeat(
        withSequence(
          withTiming(8, { duration: 600, easing: Easing.inOut(Easing.ease) }),
          withTiming(-8, { duration: 600, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        true
      )
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [
      { translateY: needleY.value },
      { rotate: `${needleRotate.value}deg` },
    ],
  }));

  return (
    <Animated.View style={[styles.needleContainer, animatedStyle]}>
      {/* Needle body */}
      <View style={styles.needleBody}>
        <View style={styles.needlePoint} />
        <View style={styles.needleShaft} />
        <View style={styles.needleEye}>
          <View style={styles.needleEyeHole} />
        </View>
      </View>
    </Animated.View>
  );
}

// ─── Animated stitch dots ────────────────────────────────────────
function StitchLine() {
  const stitchCount = 9;
  const stitches = Array.from({ length: stitchCount });

  return (
    <View style={styles.stitchContainer}>
      {stitches.map((_, i) => (
        <StitchDot key={i} index={i} total={stitchCount} />
      ))}
    </View>
  );
}

function StitchDot({ index, total }: { index: number; total: number }) {
  const opacity = useSharedValue(0);
  const scaleY = useSharedValue(0);

  useEffect(() => {
    const baseDelay = 1400;
    const stagger = 120;
    opacity.value = withDelay(
      baseDelay + index * stagger,
      withTiming(1, { duration: 300 })
    );
    scaleY.value = withDelay(
      baseDelay + index * stagger,
      withSpring(1, { damping: 8, stiffness: 150 })
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scaleY: scaleY.value }],
  }));

  const isEven = index % 2 === 0;
  return (
    <Animated.View
      style={[
        styles.stitch,
        {
          backgroundColor: isEven
            ? "rgba(212, 175, 55, 0.9)"
            : "rgba(160, 82, 45, 0.7)",
          transform: [{ rotate: isEven ? "45deg" : "-45deg" }],
        },
        animatedStyle,
      ]}
    />
  );
}

// ─── Floating shimmer particles ──────────────────────────────────
function ShimmerParticles() {
  const particles = Array.from({ length: 12 });

  return (
    <>
      {particles.map((_, i) => (
        <ShimmerDot key={i} index={i} />
      ))}
    </>
  );
}

function ShimmerDot({ index }: { index: number }) {
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(0);
  const translateX = useSharedValue(0);

  const startX = Math.random() * width;
  const startY = Math.random() * height;
  const size = 2 + Math.random() * 4;

  useEffect(() => {
    const delay = 600 + Math.random() * 2000;
    opacity.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(0.7 + Math.random() * 0.3, { duration: 1200 + Math.random() * 800 }),
          withTiming(0, { duration: 1200 + Math.random() * 800 })
        ),
        -1,
        false
      )
    );
    translateY.value = withDelay(
      delay,
      withRepeat(
        withTiming(-30 - Math.random() * 40, {
          duration: 2500 + Math.random() * 1500,
          easing: Easing.inOut(Easing.ease),
        }),
        -1,
        true
      )
    );
    translateX.value = withDelay(
      delay,
      withRepeat(
        withTiming(-10 + Math.random() * 20, {
          duration: 3000 + Math.random() * 1000,
          easing: Easing.inOut(Easing.ease),
        }),
        -1,
        true
      )
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [
      { translateY: translateY.value },
      { translateX: translateX.value },
    ],
  }));

  return (
    <Animated.View
      style={[
        {
          position: "absolute",
          left: startX,
          top: startY,
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: "rgba(251, 191, 36, 0.6)",
        },
        animatedStyle,
      ]}
    />
  );
}

// ─── Main Splash Screen ──────────────────────────────────────────
export default function SplashScreen({ onFinish }: SplashScreenProps) {
  // Logo animations
  const logoScale = useSharedValue(0.3);
  const logoOpacity = useSharedValue(0);
  const logoRotate = useSharedValue(-15);

  // Ring pulse
  const ringScale = useSharedValue(0.8);
  const ringOpacity = useSharedValue(0);

  // Brand text
  const brandOpacity = useSharedValue(0);
  const brandTranslateY = useSharedValue(20);

  // Tagline
  const taglineOpacity = useSharedValue(0);
  const taglineTranslateY = useSharedValue(15);

  // Progress bar
  const progressWidth = useSharedValue(0);
  const progressOpacity = useSharedValue(0);

  // Fade out
  const screenOpacity = useSharedValue(1);

  useEffect(() => {
    // 1. Logo entrance — scale + rotate + fade
    logoOpacity.value = withDelay(
      200,
      withTiming(1, { duration: 800, easing: Easing.out(Easing.exp) })
    );
    logoScale.value = withDelay(
      200,
      withSpring(1, { damping: 12, stiffness: 100, mass: 0.8 })
    );
    logoRotate.value = withDelay(
      200,
      withSpring(0, { damping: 14, stiffness: 80 })
    );

    // 2. Ring pulse
    ringOpacity.value = withDelay(
      500,
      withTiming(1, { duration: 600 })
    );
    ringScale.value = withDelay(
      500,
      withRepeat(
        withSequence(
          withTiming(1.15, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
          withTiming(0.95, { duration: 1500, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        true
      )
    );

    // 3. Brand name
    brandOpacity.value = withDelay(
      900,
      withTiming(1, { duration: 700, easing: Easing.out(Easing.ease) })
    );
    brandTranslateY.value = withDelay(
      900,
      withSpring(0, { damping: 15, stiffness: 90 })
    );

    // 4. Tagline
    taglineOpacity.value = withDelay(
      1300,
      withTiming(1, { duration: 600 })
    );
    taglineTranslateY.value = withDelay(
      1300,
      withSpring(0, { damping: 15, stiffness: 90 })
    );

    // 5. Progress bar
    progressOpacity.value = withDelay(
      1600,
      withTiming(1, { duration: 400 })
    );
    progressWidth.value = withDelay(
      1800,
      withTiming(1, {
        duration: 2000,
        easing: Easing.bezier(0.25, 0.46, 0.45, 0.94),
      })
    );

    // 6. Final fade out after everything completes
    screenOpacity.value = withDelay(
      4200,
      withTiming(0, { duration: 600, easing: Easing.in(Easing.ease) }, () => {
        runOnJS(onFinish)();
      })
    );
  }, []);

  // Animated styles
  const logoAnimatedStyle = useAnimatedStyle(() => ({
    opacity: logoOpacity.value,
    transform: [
      { scale: logoScale.value },
      { rotate: `${logoRotate.value}deg` },
    ],
  }));

  const ringAnimatedStyle = useAnimatedStyle(() => ({
    opacity: ringOpacity.value,
    transform: [{ scale: ringScale.value }],
  }));

  const brandAnimatedStyle = useAnimatedStyle(() => ({
    opacity: brandOpacity.value,
    transform: [{ translateY: brandTranslateY.value }],
  }));

  const taglineAnimatedStyle = useAnimatedStyle(() => ({
    opacity: taglineOpacity.value,
    transform: [{ translateY: taglineTranslateY.value }],
  }));

  const progressBarAnimatedStyle = useAnimatedStyle(() => ({
    width: `${interpolate(progressWidth.value, [0, 1], [0, 100])}%` as any,
  }));

  const progressContainerStyle = useAnimatedStyle(() => ({
    opacity: progressOpacity.value,
  }));

  const screenAnimatedStyle = useAnimatedStyle(() => ({
    opacity: screenOpacity.value,
  }));

  return (
    <Animated.View style={[styles.container, screenAnimatedStyle]}>
      <LinearGradient
        colors={["#0B1120", "#151E30", "#1A2540", "#12192B"]}
        locations={[0, 0.3, 0.7, 1]}
        style={StyleSheet.absoluteFillObject}
      />

      {/* Floating shimmer particles */}
      <ShimmerParticles />

      {/* Subtle top decorative line */}
      <View style={styles.topAccent}>
        <LinearGradient
          colors={["transparent", "rgba(212, 175, 55, 0.3)", "transparent"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.accentLine}
        />
      </View>

      {/* Logo section */}
      <View style={styles.logoSection}>
        {/* Pulsing outer ring */}
        <Animated.View style={[styles.outerRing, ringAnimatedStyle]}>
          <LinearGradient
            colors={[
              "rgba(212, 175, 55, 0.15)",
              "rgba(160, 82, 45, 0.08)",
              "rgba(212, 175, 55, 0.15)",
            ]}
            style={styles.outerRingGradient}
          />
        </Animated.View>

        {/* Main logo circle */}
        <Animated.View style={[styles.logoWrapper, logoAnimatedStyle]}>
          <LinearGradient
            colors={[
              "rgba(212, 175, 55, 0.2)",
              "rgba(160, 82, 45, 0.15)",
              "rgba(107, 58, 10, 0.2)",
            ]}
            style={styles.logoCircle}
          >
            <View style={styles.logoInnerBorder}>
              <Image
                source={require("../assets/images/logo.png")}
                style={styles.logo}
                resizeMode="contain"
              />
            </View>
          </LinearGradient>
        </Animated.View>
      </View>

      {/* Animated needle */}
      <AnimatedNeedle />

      {/* Stitch line */}
      <StitchLine />

      {/* Brand name */}
      <Animated.Text style={[styles.brandName, brandAnimatedStyle]}>
        Jackmans
      </Animated.Text>
      <Animated.Text style={[styles.brandSub, brandAnimatedStyle]}>
        Tailor Deluxe
      </Animated.Text>

      {/* Tagline */}
      <Animated.Text style={[styles.tagline, taglineAnimatedStyle]}>
        Crafting Elegance, Stitch by Stitch
      </Animated.Text>

      {/* Progress indicator */}
      <Animated.View style={[styles.progressContainer, progressContainerStyle]}>
        <View style={styles.progressTrack}>
          <Animated.View style={[styles.progressFill, progressBarAnimatedStyle]}>
            <LinearGradient
              colors={["#D4AF37", "#A0522D", "#D4AF37"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={StyleSheet.absoluteFillObject}
            />
          </Animated.View>
        </View>
        <Animated.Text style={[styles.loadingText, progressContainerStyle]}>
          Preparing your experience...
        </Animated.Text>
      </Animated.View>

      {/* Bottom decorative line */}
      <View style={styles.bottomAccent}>
        <LinearGradient
          colors={["transparent", "rgba(212, 175, 55, 0.2)", "transparent"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.accentLine}
        />
      </View>
    </Animated.View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 999,
  },

  // Top / Bottom accent lines
  topAccent: {
    position: "absolute",
    top: height * 0.08,
    width: width * 0.6,
  },
  bottomAccent: {
    position: "absolute",
    bottom: height * 0.06,
    width: width * 0.5,
  },
  accentLine: {
    height: 1,
    width: "100%",
  },

  // Logo section
  logoSection: {
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  outerRing: {
    position: "absolute",
    width: 170,
    height: 170,
    borderRadius: 85,
    overflow: "hidden",
  },
  outerRingGradient: {
    flex: 1,
    borderRadius: 85,
    borderWidth: 1,
    borderColor: "rgba(212, 175, 55, 0.25)",
  },
  logoWrapper: {
    shadowColor: "#D4AF37",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 30,
    elevation: 20,
  },
  logoCircle: {
    width: 140,
    height: 140,
    borderRadius: 70,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "rgba(212, 175, 55, 0.4)",
  },
  logoInnerBorder: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(212, 175, 55, 0.15)",
    overflow: "hidden",
  },
  logo: {
    width: 110,
    height: 110,
  },

  // Needle
  needleContainer: {
    alignItems: "center",
    marginTop: 10,
    marginBottom: 6,
    height: 50,
    justifyContent: "center",
  },
  needleBody: {
    flexDirection: "column",
    alignItems: "center",
  },
  needlePoint: {
    width: 0,
    height: 0,
    borderLeftWidth: 3,
    borderRightWidth: 3,
    borderBottomWidth: 10,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    borderBottomColor: "#C0C0C0",
  },
  needleShaft: {
    width: 2.5,
    height: 28,
    backgroundColor: "#C0C0C0",
    borderRadius: 1,
  },
  needleEye: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#A8A8A8",
    justifyContent: "center",
    alignItems: "center",
  },
  needleEyeHole: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: "#1A2540",
  },

  // Stitch line
  stitchContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginVertical: 12,
    paddingHorizontal: 30,
  },
  stitch: {
    width: 2,
    height: 12,
    borderRadius: 1,
  },

  // Brand text
  brandName: {
    fontSize: 36,
    fontWeight: "300",
    color: "#FFFFFF",
    letterSpacing: 8,
    textTransform: "uppercase",
    marginTop: 16,
    textShadowColor: "rgba(212, 175, 55, 0.3)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 15,
  },
  brandSub: {
    fontSize: 16,
    fontWeight: "300",
    color: "rgba(212, 175, 55, 0.9)",
    letterSpacing: 12,
    textTransform: "uppercase",
    marginTop: 4,
  },

  // Tagline
  tagline: {
    fontSize: 13,
    fontStyle: "italic",
    color: "rgba(203, 213, 225, 0.7)",
    letterSpacing: 2,
    marginTop: 20,
  },

  // Progress
  progressContainer: {
    alignItems: "center",
    marginTop: 50,
    width: width * 0.5,
  },
  progressTrack: {
    width: "100%",
    height: 2,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderRadius: 1,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 1,
    overflow: "hidden",
  },
  loadingText: {
    fontSize: 11,
    color: "rgba(203, 213, 225, 0.5)",
    letterSpacing: 2,
    marginTop: 14,
    textTransform: "uppercase",
  },
});
