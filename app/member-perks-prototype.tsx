import { Redirect } from "expo-router";

// A static import would retain this development screen and all its assets.
const Screen = __DEV__
  ? require("@/components/dev/screens/member-perks-prototype").default
  : () => <Redirect href="/(tabs)/shop" />;

export default Screen;
