import { Redirect } from "expo-router";

// A static import would retain this development screen and all its assets.
const Screen = __DEV__
  ? require("@/components/dev/screens/ad-refill-preview").default
  : () => <Redirect href="/" />;

export default Screen;
