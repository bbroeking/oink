const IOS_TEST_APP_ID = "ca-app-pub-3940256099942544~1458002511";
const ANDROID_TEST_APP_ID = "ca-app-pub-3940256099942544~3347511713";

module.exports = ({ config }) => {
	const productionProfile = process.env.EAS_BUILD_PROFILE === "production";
	const buildPlatform = process.env.EAS_BUILD_PLATFORM;
	const iosAppId = process.env.ADMOB_IOS_APP_ID || IOS_TEST_APP_ID;
	const androidAppId = process.env.ADMOB_ANDROID_APP_ID || ANDROID_TEST_APP_ID;

	if (
		productionProfile &&
		buildPlatform !== "android" &&
		iosAppId === IOS_TEST_APP_ID
	) {
		throw new Error(
			"ADMOB_IOS_APP_ID is required for a production build; refusing to ship Google's test app ID."
		);
	}
	if (
		productionProfile &&
		buildPlatform === "android" &&
		androidAppId === ANDROID_TEST_APP_ID
	) {
		throw new Error(
			"ADMOB_ANDROID_APP_ID is required for a production build; refusing to ship Google's test app ID."
		);
	}

	return {
		...config,
		plugins: [
			...(config.plugins || []),
			"@sentry/react-native",
			"expo-web-browser",
			"expo-status-bar",
			[
				"react-native-google-mobile-ads",
				{
					iosAppId,
					androidAppId,
					delayAppMeasurementInit: true,
				},
			],
		],
	};
};
