import { BotMessageSquareIcon, ChartColumnIcon, GaugeIcon, MessageCircleIcon, SendIcon, ShieldCheckIcon, SparklesIcon, UserIcon, WebhookIcon, WrenchIcon, type LucideIcon } from "lucide-react";
import { siNeon, siNextdotjs, siPaypal, siResend, siVercel } from "simple-icons";
import { AgentAvatar } from "@/components/brand/agent-avatar";
import type { Logo } from "@/lib/architecture";
import { cn } from "@/lib/utils";

// Real brand marks where a vendor is the node (simple-icons, CC0), and plain icons for Lifeline's own parts.
// OpenAI isn't in simple-icons, so it gets a plain icon.
const BRANDS = { paypal: siPaypal, vercel: siVercel, neon: siNeon, nextjs: siNextdotjs, resend: siResend } as const;
const ICONS: Partial<Record<Logo, LucideIcon>> = { person: UserIcon, webhook: WebhookIcon, chart: ChartColumnIcon, chat: MessageCircleIcon, shield: ShieldCheckIcon, gauge: GaugeIcon, send: SendIcon, wrench: WrenchIcon, openai: BotMessageSquareIcon };

export function NodeLogo({ logo, className }: { logo: Logo; className?: string }) {
  if (logo === "agent") return <AgentAvatar glossy still mood="idle" label="" className={cn("size-9", className)} />;
  if (logo in BRANDS) {
    const icon = BRANDS[logo as keyof typeof BRANDS];
    return (
      <span className={cn("grid size-9 shrink-0 place-items-center rounded-lg border bg-white", className)}>
        <svg viewBox="0 0 24 24" role="img" aria-label={icon.title} className="size-5" fill={`#${icon.hex}`}>
          <path d={icon.path} />
        </svg>
      </span>
    );
  }
  const Icon = ICONS[logo] ?? SparklesIcon;
  return (
    <span className={cn("grid size-9 shrink-0 place-items-center rounded-lg border bg-paper text-ink", (logo === "shield" || logo === "gauge") && "text-recovered", logo === "wrench" && "text-caution", className)}>
      <Icon aria-hidden className="size-[18px]" />
    </span>
  );
}
