import { AgentAvatar, type AgentMood } from "@/components/brand/agent-avatar";

export const metadata = { title: "Agent" };

const MOODS: { mood: AgentMood; when: string }[] = [
  { mood: "idle", when: "Watching PayPal" },
  { mood: "working", when: "Looking into a failed gift" },
  { mood: "thinking", when: "Choosing a fix" },
  { mood: "worried", when: "A gift just failed" },
  { mood: "happy", when: "Fix ready · donor saved" },
];

// Design reference for the Lifeline AI avatar's moods, at the sizes the app uses.
export default function AgentStyleguide() {
  return (
    <main className="mx-auto max-w-5xl space-y-10 bg-paper px-8 py-10">
      <div className="grid grid-cols-5 gap-6">
        {MOODS.map(({ mood, when }) => (
          <figure key={mood} className="flex flex-col items-center gap-3 rounded-2xl border border-line bg-surface p-6 shadow-soft">
            <AgentAvatar mood={mood} className="size-28" />
            <figcaption className="text-center">
              <p className="text-sm font-medium capitalize">{mood}</p>
              <p className="text-xs text-muted-foreground">{when}</p>
            </figcaption>
          </figure>
        ))}
      </div>
      <div className="flex items-end gap-6 rounded-2xl border border-line bg-surface p-6">
        <AgentAvatar mood="happy" className="size-16" />
        <AgentAvatar mood="idle" className="size-10" />
        <AgentAvatar mood="working" className="size-6" calm />
      </div>
    </main>
  );
}
