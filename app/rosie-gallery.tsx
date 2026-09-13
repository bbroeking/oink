import { Redirect } from "expo-router";
const Screen = __DEV__
  ? require("@/components/dev/screens/rosie-gallery").default
  : () => <Redirect href="/" />;
export default Screen;
