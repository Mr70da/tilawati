/**
 * A bottom sheet: the backdrop fades while the sheet glides up on one smooth curve (no spring overshoot), and both
 * animate back out before the modal unmounts. `onClosed` runs once the exit has finished, which is the moment to
 * navigate away without the sheet lingering over the next screen.
 */
import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Modal, Pressable, StyleSheet, View } from "react-native";
import Animated, { Easing, interpolate, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { radius, space, useTheme } from "./theme";

const OPEN = { duration: 320, easing: Easing.bezier(0.22, 1, 0.36, 1) }; // ease-out-quint
const CLOSE = { duration: 220, easing: Easing.bezier(0.4, 0, 1, 1) };

export function Sheet({ open, onClose, onClosed, children }: { open: boolean; onClose: () => void; onClosed?: () => void; children: ReactNode }) {
  const { c } = useTheme();
  const [mounted, setMounted] = useState(open);
  if (open && !mounted) setMounted(true);

  const progress = useSharedValue(0);
  const height = useSharedValue(600);

  const wasOpen = useRef(false);
  useEffect(() => {
    if (!open && !wasOpen.current) return;
    wasOpen.current = open;
    if (open) progress.set(withTiming(1, OPEN));
    else
      progress.set(
        withTiming(0, CLOSE, (finished) => {
          if (finished) {
            scheduleOnRN(setMounted, false);
            if (onClosed) scheduleOnRN(onClosed);
          }
        }),
      );
  }, [open, progress, onClosed]);

  const backdrop = useAnimatedStyle(() => ({ opacity: progress.get() }));
  const sheet = useAnimatedStyle(() => ({
    transform: [{ translateY: interpolate(progress.get(), [0, 1], [height.get() + 24, 0]) }],
  }));

  return (
    <Modal visible={mounted} transparent animationType="none" statusBarTranslucent navigationBarTranslucent onRequestClose={onClose}>
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(0,0,0,0.4)" }, backdrop]}>
        <Pressable style={{ flex: 1 }} onPress={onClose} accessibilityRole="button" />
      </Animated.View>
      <View style={{ flex: 1 }} pointerEvents="box-none" />
      <Animated.View
        onLayout={(e) => height.set(e.nativeEvent.layout.height)}
        style={[
          {
            backgroundColor: c.surface,
            borderTopLeftRadius: radius.xl,
            borderTopRightRadius: radius.xl,
            padding: space(2.5),
            paddingBottom: space(6),
            gap: space(1.25),
          },
          sheet,
        ]}
      >
        <View style={{ alignSelf: "center", width: 40, height: 4, borderRadius: 2, backgroundColor: c.border, marginBottom: space(1) }} />
        {children}
      </Animated.View>
    </Modal>
  );
}
