import { Redirect } from "expo-router";

/** The exploratory variants were retired when the full-page reel machine won. */
export default function RetiredMoteMachinePrototype() {
  return <Redirect href="/mote-machine" />;
}
