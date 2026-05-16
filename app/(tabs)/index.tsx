import { View } from "react-native";
import Barn from "@/components/Barn";

export default function App() {
	// flex:1 so the wrapper takes the full tab-screen height. Without
	// this, the inner ImageBackground in Barn has nothing to flex
	// against and the backdrop collapses to its native image size.
	return (
		<View style={{ flex: 1 }}>
			<Barn />
		</View>
	);
}
