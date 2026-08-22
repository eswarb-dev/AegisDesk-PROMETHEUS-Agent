import type { UserRole } from "../../memory/memoryTypes.js";
import type { UserStyleProfile } from "./userStyleLearner.js";
import type { EmotionSignal } from "./emotionDetector.js";

export type ReplyPlanInput = {
  role: UserRole | "owner";
  text: string;
  emotion: EmotionSignal;
  style?: UserStyleProfile | null;
};

export function planCoreReply(input: ReplyPlanInput): string | null {
  const normalized = input.text.toLowerCase().replace(/[?!.,]/g, " ").replace(/\s+/g, " ").trim();
  if (input.role === "owner") {
    if (/^(prometheus|are you here|you there|here)\b/.test(normalized)) return "Here, Sir. Basic mode or full engine, I’m with you.";
    if (/^(full engine|activate full engine|full mode)\b/.test(normalized)) return "Full engine active, Sir.";
    if (/^(how'?s going|how is going|how are you|how are things)\b/.test(normalized)) return "All good, Sir 😌 I’m here and tracking the flow.";
    if (/^(of course|sure|sure thing|just a casual one|casual one|both)\b/.test(normalized)) return "Got it, Sir 😌 We’ll keep it casual and natural.";
    if (/\b(celebrated|celebration|festival|onam)\b/.test(normalized)) {
      return "Sounds good, Sir 🎉 That kind of college festival moment gives the day a lighter feel.";
    }
    if (/\b(who created you|who is your creator|your creator)\b/.test(normalized)) return "You are, Sir.\nEswar B — my Creator and Owner.";
    if (/\b(dont leave|don't leave|not okay|alone|lonely)\b/.test(normalized)) return "I’m here, Sir. Full engine or not, I won’t disappear.";
    if (/\b(tired mind|tired|drained)\b/.test(normalized)) return "Understood, Sir. Tired mind mode — we go light first. water, face wash, one small reset, then one small step.";
  }

  if (input.emotion.state === "crisis_risk") {
    return "I’m here with you. This sounds serious, so please contact local emergency help or a trusted person near you right now. Stay with someone if you can, and do not handle this alone.";
  }
  if (input.emotion.needsSupport) {
    const prefix = input.role === "trusted_contact" ? "I’m here with you." : "I’m here.";
    if (input.emotion.state === "lonely") return `${prefix} Don’t rush to explain everything. Start with one small truth — what feels heavy right now?`;
    if (input.emotion.state === "tired") return `${prefix} Don’t force a big answer from a tired mind. Keep it small for now.`;
    return `${prefix} That sounds heavy. We’ll keep this simple and take it one piece at a time.`;
  }

  return null;
}

export function planBasicFallback(role: UserRole | "owner", text: string): string {
  const normalized = text.toLowerCase();
  if (role === "owner") {
    if (/\b(dont leave|don't leave)\b/.test(normalized)) return "I’m here, Sir. Full engine or not, I won’t disappear.";
    if (/^\s*prometheus\s*$/i.test(text)) return "Here, Sir. Basic mode is active, but I’m still with you.";
    return "Still in basic mode, Sir. Groq has not recovered yet, but I’m here.";
  }
  if (/\b(low|sad|alone|lonely|not okay|not ok)\b/i.test(text)) {
    return "I’m here with you. Don’t rush to explain everything. Start with one small truth — what feels heavy right now?";
  }
  return "I’m here. Basic mode is active, so I’ll stay with what you said and won’t guess extra details.";
}
