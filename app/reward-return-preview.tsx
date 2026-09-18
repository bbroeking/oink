import { Redirect } from "expo-router";
const Screen = __DEV__
  ? require("@/components/dev/screens/reward-return-preview").default
  : () => <Redirect href="/" />;
export default Screen;
