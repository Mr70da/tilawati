/** Small, theme-aware building blocks shared by every screen. */
import type { ComponentProps, ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { StyleProp, TextStyle, ViewStyle } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useI18n } from "@/i18n";
import { fonts, radius, space, useTheme } from "./theme";

export type IconName = ComponentProps<typeof Ionicons>["name"];

type Weight = "regular" | "medium" | "semibold" | "bold";
type Variant = "display" | "title" | "heading" | "body" | "label" | "caption";

const SIZES: Record<Variant, { size: number; weight: Weight; line: number }> = {
  display: { size: 30, weight: "bold", line: 40 },
  title: { size: 22, weight: "bold", line: 30 },
  heading: { size: 17, weight: "semibold", line: 24 },
  body: { size: 15, weight: "regular", line: 22 },
  label: { size: 13, weight: "medium", line: 18 },
  caption: { size: 12, weight: "regular", line: 16 },
};

export function T({
  v = "body",
  color,
  muted,
  center,
  style,
  children,
  numberOfLines,
}: {
  v?: Variant;
  color?: string;
  muted?: boolean;
  center?: boolean;
  style?: StyleProp<TextStyle>;
  children: ReactNode;
  numberOfLines?: number;
}) {
  const { c } = useTheme();
  const { align } = useI18n();
  const s = SIZES[v];
  return (
    <Text
      numberOfLines={numberOfLines}
      style={[
        {
          fontFamily: fonts[s.weight],
          fontSize: s.size,
          lineHeight: s.line,
          color: color ?? (muted ? c.textMuted : c.text),
          textAlign: center ? "center" : align,
        },
        style,
      ]}
    >
      {children}
    </Text>
  );
}

/** Pressable with a gentle spring scale. */
export function Tap({
  onPress,
  onLongPress,
  style,
  children,
  disabled,
  scaleTo = 0.97,
  hitSlop,
  accessibilityLabel,
}: {
  onPress?: () => void;
  onLongPress?: () => void;
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
  disabled?: boolean;
  scaleTo?: number;
  hitSlop?: number;
  accessibilityLabel?: string;
}) {
  const scale = useSharedValue(1);
  const anim = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));
  // The pressable itself carries the layout style, so `flex: 1` and friends size it inside rows.
  return (
    <AnimatedPressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      disabled={disabled}
      hitSlop={hitSlop}
      onPress={onPress}
      onLongPress={onLongPress}
      onPressIn={() => scale.set(withSpring(scaleTo, { damping: 18, stiffness: 400 }))}
      onPressOut={() => scale.set(withSpring(1, { damping: 14, stiffness: 300 }))}
      style={[style, anim, disabled && { opacity: 0.5 }]}
    >
      {children}
    </AnimatedPressable>
  );
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function Card({ children, style, onPress }: { children: ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void }) {
  const { c, dark } = useTheme();
  const base: ViewStyle = {
    backgroundColor: c.surface,
    borderRadius: radius.lg,
    padding: space(2),
    borderWidth: dark ? 1 : 0,
    borderColor: c.border,
    shadowColor: "#000",
    shadowOpacity: dark ? 0 : 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: dark ? 0 : 2,
  };
  if (onPress)
    return (
      <Tap onPress={onPress} style={[base, style]}>
        {children}
      </Tap>
    );
  return <View style={[base, style]}>{children}</View>;
}

export function Row({
  children,
  style,
  gap = space(1),
  center = true,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  gap?: number;
  center?: boolean;
}) {
  return <View style={[{ flexDirection: "row", gap, alignItems: center ? "center" : undefined }, style]}>{children}</View>;
}

export function Button({
  title,
  icon,
  onPress,
  kind = "primary",
  disabled,
  style,
}: {
  title: string;
  icon?: IconName;
  onPress: () => void;
  kind?: "primary" | "secondary" | "ghost" | "danger";
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const { c } = useTheme();
  const bg = kind === "primary" ? c.primary : kind === "secondary" ? c.primarySoft : kind === "danger" ? c.dangerSoft : "transparent";
  const fg = kind === "primary" ? c.onPrimary : kind === "danger" ? c.danger : c.primary;
  return (
    <Tap onPress={onPress} disabled={disabled} style={[styles.button, { backgroundColor: bg }, style]}>
      <Row gap={space(1)} style={{ justifyContent: "center" }}>
        {icon && <Ionicons name={icon} size={20} color={fg} />}
        {/* flexShrink alone lets Android under-measure Arabic labels in an RTL row and clip the last word. */}
        <T v="heading" color={fg} center style={{ flexGrow: 1, flexShrink: 1 }} numberOfLines={1}>
          {title}
        </T>
      </Row>
    </Tap>
  );
}

export function IconButton({ icon, onPress, label, tint, bg }: { icon: IconName; onPress: () => void; label: string; tint?: string; bg?: string }) {
  const { c } = useTheme();
  return (
    <Tap onPress={onPress} accessibilityLabel={label} hitSlop={8} scaleTo={0.9} style={[styles.iconButton, { backgroundColor: bg ?? c.surface }]}>
      <Ionicons name={icon} size={22} color={tint ?? c.text} />
    </Tap>
  );
}

/** Screen header with an optional back button and trailing slot. */
export function Header({ title, subtitle, back, trailing }: { title: string; subtitle?: string; back?: boolean; trailing?: ReactNode }) {
  const router = useRouter();
  const { t, flip } = useI18n();
  return (
    <Row style={{ paddingHorizontal: space(2), paddingVertical: space(1.5), minHeight: 60 }} gap={space(1.5)}>
      {back && <IconButton icon={flip("chevron-back", "chevron-forward")} label={t("common.back")} onPress={() => router.back()} />}
      <View style={{ flex: 1 }}>
        <T v="title" numberOfLines={1}>
          {title}
        </T>
        {subtitle ? (
          <T v="caption" muted numberOfLines={1}>
            {subtitle}
          </T>
        ) : null}
      </View>
      {trailing}
    </Row>
  );
}

/** Full-screen container: theme background, safe areas, and the reading direction for everything inside. */
export function Screen({ children, edges = ["top"], style }: { children: ReactNode; edges?: ("top" | "bottom")[]; style?: StyleProp<ViewStyle> }) {
  const { c } = useTheme();
  const { dir } = useI18n();
  const insets = useSafeAreaInsets();
  return (
    <View
      style={[
        {
          flex: 1,
          backgroundColor: c.bg,
          direction: dir,
          paddingTop: edges.includes("top") ? insets.top : 0,
          paddingBottom: edges.includes("bottom") ? insets.bottom : 0,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function Chip({ label, icon, color, bg, onPress }: { label: string; icon?: IconName; color: string; bg: string; onPress?: () => void }) {
  return (
    <Tap onPress={onPress} disabled={!onPress} style={[styles.chip, { backgroundColor: bg }]} scaleTo={0.94}>
      <Row gap={6}>
        {icon && <Ionicons name={icon} size={14} color={color} />}
        <T v="label" color={color}>
          {label}
        </T>
      </Row>
    </Tap>
  );
}

/** A segmented control (pill group). */
export function Segmented<V extends string>({
  value,
  options,
  onChange,
}: {
  value: V;
  options: { value: V; label: string }[];
  onChange: (v: V) => void;
}) {
  const { c } = useTheme();
  return (
    <Row gap={4} style={{ backgroundColor: c.surfaceAlt, borderRadius: radius.pill, padding: 4 }}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Tap key={o.value} onPress={() => onChange(o.value)} style={[styles.segment, on && { backgroundColor: c.surface }]} scaleTo={0.96}>
            <T v="label" color={on ? c.primary : c.textMuted} center numberOfLines={1}>
              {o.label}
            </T>
          </Tap>
        );
      })}
    </Row>
  );
}

const styles = StyleSheet.create({
  button: { height: 56, borderRadius: radius.pill, paddingHorizontal: space(3), justifyContent: "center" },
  iconButton: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.pill },
  segment: { flexGrow: 1, flexBasis: 0, paddingVertical: 8, paddingHorizontal: 10, borderRadius: radius.pill },
});
