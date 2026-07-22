#!/usr/bin/env bash

set -euo pipefail

AVD_NAME="${TTP_ANDROID_AVD:-TicklePig_API_35}"
ANDROID_HOME="${ANDROID_HOME:-/opt/homebrew/share/android-commandlinetools}"
ANDROID_SDK_ROOT="${ANDROID_SDK_ROOT:-$ANDROID_HOME}"

if [[ -d /opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home ]]; then
  JAVA_HOME="${JAVA_HOME:-/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home}"
else
  JAVA_HOME="${JAVA_HOME:-$(/usr/libexec/java_home -v 17)}"
fi

export ANDROID_HOME ANDROID_SDK_ROOT JAVA_HOME
export PATH="$JAVA_HOME/bin:$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator:$PATH"
export NODE_OPTIONS="${NODE_OPTIONS:---max-old-space-size=16384}"
export NODE_ENV="${NODE_ENV:-development}"

for command in adb emulator; do
  if ! command -v "$command" >/dev/null 2>&1; then
    echo "Missing $command. Expected the Android SDK at $ANDROID_HOME." >&2
    exit 1
  fi
done

adb start-server >/dev/null

if ! adb devices | grep -q '^emulator-.*device$'; then
  if ! emulator -list-avds | grep -Fxq "$AVD_NAME"; then
    echo "Android virtual device '$AVD_NAME' does not exist." >&2
    exit 1
  fi

  echo "Starting Android virtual device $AVD_NAME..."
  emulator -avd "$AVD_NAME" -no-snapshot-load -no-boot-anim \
    >"${TMPDIR:-/tmp}/tickle-pig-emulator.log" 2>&1 &

  for _ in {1..120}; do
    if [[ "$(adb shell getprop sys.boot_completed 2>/dev/null || true)" == "1" ]]; then
      break
    fi
    sleep 2
  done

  if [[ "$(adb shell getprop sys.boot_completed 2>/dev/null || true)" != "1" ]]; then
    echo "The Android emulator did not finish booting within four minutes." >&2
    exit 1
  fi
fi

adb reverse tcp:8081 tcp:8081 >/dev/null 2>&1 || true

echo "Building and installing the Android debug app..."
(
  cd android
  ./gradlew app:assembleDebug
)
adb install -r -t android/app/build/outputs/apk/debug/app-debug.apk >/dev/null

if curl -fsS http://localhost:8081/status 2>/dev/null | grep -q 'packager-status:running'; then
  echo "Connecting to the Metro server already running on port 8081..."
  adb shell am force-stop com.broeking.ttp
  adb shell am start \
    -a android.intent.action.VIEW \
    -d 'exp+ttp://expo-development-client/?url=http%3A%2F%2F127.0.0.1%3A8081' \
    com.broeking.ttp >/dev/null
else
  echo "Starting Metro. Keep this terminal open while developing."
  npx expo start --dev-client --localhost --android
fi
