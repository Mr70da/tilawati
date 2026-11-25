/** The record button: a calm orb that breathes with the reciter's voice. */
import { useEffect } from "react";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withRepeat,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import type { SharedValue } from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "./theme";

const SIZE = 84;

export function MicOrb({
  listening,
  busy,
  level,
  onPress,
  label,
}: {
  listening: boolean;
  busy?: boolean;
  level: SharedValue<number>;
  onPress: () => void;
  label: string;
}) {
  const { c } = useTheme();
  const breathe = useSharedValue(0);

  useEffect(() => {
    if (listening) breathe.set(withRepeat(withTiming(1, { duration: 1800, easing: Easing.inOut(Easing.sin) }), -1, true));
    else {
      cancelAnimation(breathe);
      breathe.set(withTiming(0, { duration: 300 }));
    }
  }, [listening, breathe]);

  const smoothLevel = useDerivedValue(() => withSpring(level.get(), { damping: 20, stiffness: 180 }));
  const outer = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + (listening ? 0.08 + smoothLevel.get() * 0.55 + breathe.get() * 0.06 : 0) }],
    opacity: listening ? 0.25 * (0.5 + smoothLevel.get()) : 0,
  }));
  const inner = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + (listening ? 0.08 + smoothLevel.get() * 0.33 + breathe.get() * 0.06 : 0) }],
    opacity: listening ? 0.45 * (0.5 + smoothLevel.get()) : 0,
  }));
  const core = useAnimatedStyle(() => ({ transform: [{ scale: 1 + (listening ? breathe.get() * 0.03 : 0) }] }));

  return (
    <View style={styles.wrap}>
      <Animated.View style={[styles.ring, { backgroundColor: listening ? c.danger : c.primary }, outer]} />
      <Animated.View style={[styles.ring, { backgroundColor: listening ? c.danger : c.primary }, inner]} />
      <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} disabled={busy}>
        <Animated.View
          style={[styles.core, { backgroundColor: listening ? c.danger : c.primary, shadowColor: listening ? c.danger : c.primary }, core]}
        >
          {busy ? (
            <ActivityIndicator color={c.onPrimary} />
          ) : (
            <Ionicons name={listening ? "stop" : "mic"} size={listening ? 30 : 36} color={listening ? "#fff" : c.onPrimary} />
          )}
        </Animated.View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: SIZE * 1.9, height: SIZE * 1.9, alignItems: "center", justifyContent: "center" },
  ring: { position: "absolute", width: SIZE, height: SIZE, borderRadius: SIZE / 2 },
  core: {
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    alignItems: "center",
    justifyContent: "center",
    shadowOpacity: 0.35,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
});
