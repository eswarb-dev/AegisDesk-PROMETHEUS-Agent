import type { UserRole } from "../../memory/memoryTypes.js";
import { decideCoreResponseMode, type CoreResponseMode } from "./responseModeDecider.js";
import { detectIntent, type PrometheusIntent } from "./intentDetector.js";
import { detectEmotion, type EmotionSignal } from "./emotionDetector.js";
import { analyzeSlangStyle, type StyleSignal } from "./slangStyleAnalyzer.js";
import { planBasicFallback, planCoreReply } from "./replyPlanner.js";
import { validatePlannedResponse } from "./responseValidator.js";
import { buildLearningEvent, type LearningEventDraft } from "./memoryReflectionEngine.js";
import type { UserStyleProfile } from "./userStyleLearner.js";

export type PrometheusCoreInput = {
  role: UserRole | "owner";
  text: string;
  style?: UserStyleProfile | null;
};

export type PrometheusCoreDecision = {
  mode: CoreResponseMode;
  intent: PrometheusIntent;
  emotion: EmotionSignal;
  styleSignal: StyleSignal;
  deterministicReply: string | null;
  learningEvent: LearningEventDraft | null;
};

export class PrometheusCore {
  decide(input: PrometheusCoreInput): PrometheusCoreDecision {
    const intent = detectIntent(input.text);
    const emotion = detectEmotion(input.text);
    const styleSignal = analyzeSlangStyle(input.text);
    const mode = decideCoreResponseMode(input.text, input.role);
    const planned = mode === "CORE_MEMORY_REPLY" || mode === "EMOTIONAL_SUPPORT_REPLY"
      ? planCoreReply({ role: input.role, text: input.text, emotion, style: input.style })
      : null;
    const deterministicReply = planned && validatePlannedResponse(planned, input.role) ? planned : null;
    return {
      mode,
      intent,
      emotion,
      styleSignal,
      deterministicReply,
      learningEvent: buildLearningEvent(input.text, input.role, styleSignal, emotion)
    };
  }

  basicFallback(role: UserRole | "owner", text: string): string {
    return planBasicFallback(role, text);
  }
}

export const prometheusCore = new PrometheusCore();
