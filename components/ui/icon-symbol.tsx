import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { SymbolWeight, SymbolViewProps } from "expo-symbols";
import { ComponentProps } from "react";
import { OpaqueColorValue, type StyleProp, type TextStyle } from "react-native";

type IconMapping = Record<SymbolViewProps["name"], ComponentProps<typeof MaterialIcons>["name"]>;
type IconSymbolName = keyof typeof MAPPING;

const MAPPING = {
  "house.fill": "home",
  "person.2.fill": "people",
  "calendar": "event",
  "calendar.badge.plus": "event-available",
  "gearshape.fill": "settings",
  "paperplane.fill": "send",
  "chevron.left.forwardslash.chevron.right": "code",
  "chevron.right": "chevron-right",
  "plus": "add",
  "magnifyingglass": "search",
  "phone.fill": "phone",
  "envelope.fill": "email",
  "building.2.fill": "business",
  "note.text": "note",
  "trash.fill": "delete",
  "pencil": "edit",
  "xmark": "close",
  "checkmark": "check",
  "clock.fill": "access-time",
  "arrow.left": "arrow-back",
  "ellipsis": "more-horiz",
  "square.and.arrow.up": "ios-share",
  "arrow.down.doc.fill": "file-download",
  "key.fill": "vpn-key",
  "person.fill": "person",
  "tag.fill": "label",
  "message.fill": "message",
  "exclamationmark.triangle.fill": "warning",
  "info.circle.fill": "info",
  "car.fill": "directions-car",
  "mappin": "place",
  "sparkles": "auto-awesome",
  "arrow.clockwise": "refresh",
  "bubble.left.and.bubble.right": "forum",
  "list.bullet.clipboard": "assignment",
  "map.fill": "map",
  "location.fill": "my-location",
  "flag.fill": "flag",
  "bell.fill": "notifications",
  "arrow.triangle.turn.up.right.diamond.fill": "directions",
  "pin.fill": "push-pin",
  "repeat": "repeat",
  "person.badge.plus": "person-add",
  "star.fill": "star",
} as IconMapping;

export function IconSymbol({
  name,
  size = 24,
  color,
  style,
}: {
  name: IconSymbolName;
  size?: number;
  color: string | OpaqueColorValue;
  style?: StyleProp<TextStyle>;
  weight?: SymbolWeight;
}) {
  return <MaterialIcons color={color} size={size} name={MAPPING[name]} style={style} />;
}
