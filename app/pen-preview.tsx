import { Redirect } from "expo-router";
const Screen = __DEV__
  ? require("@/components/dev/screens/pen-preview").default
  : () => <Redirect href="/" />;
export default Screen;
