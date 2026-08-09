import { useState } from "react";
import { Redirect, Stack, useLocalSearchParams } from "expo-router";
import { BarnVisitModal } from "@/components/BarnVisitModal";
import { MotionPolicyProvider } from "@/hooks/useMotionPolicy";

export default function BarnVisitPreviewScreen() {
  if (!__DEV__) return <Redirect href="/" />;
  return <BarnVisitPreview />;
}

function BarnVisitPreview() {
  const { motion } = useLocalSearchParams<{
    motion?: string | string[];
  }>();
  const requestedMotion = Array.isArray(motion) ? motion[0] : motion;
  const [visitKey, setVisitKey] = useState(0);

  return (
    <MotionPolicyProvider reduceMotion={requestedMotion === "reduced"}>
      <Stack.Screen options={{ headerShown: false }} />
      <BarnVisitModal
        key={visitKey}
        targetUserId="barn-preview-friend"
        targetName="Maple"
        previewState="tickled-out"
        onClose={() => setVisitKey((current) => current + 1)}
      />
    </MotionPolicyProvider>
  );
}
