import { Redirect } from "expo-router";
const Screen = __DEV__
  ? require("@/components/dev/screens/barn-housing-preview").default
  : () => <Redirect href="/" />;
export default Screen;
