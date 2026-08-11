import type { Context } from "telegraf";

export async function helpCommand(ctx: Context): Promise<void> {
  await ctx.reply(
    [
      "PROMETHEUS Commands",
      "",
      "/start   Activate PROMETHEUS",
      "/help    Show commands",
      "/about   Agent identity",
      "/ping    Check bot connectivity",
      "/memory  Show memory status",
      "/whoami  Show your access role",
      "/contacts Owner trusted-contact panel",
      "/trust   Owner approve trusted contact",
      "/untrust Owner revoke trusted access",
      "/tell    Owner message trusted contact",
      "",
      "You can also talk to me normally."
    ].join("\n")
  );
}
