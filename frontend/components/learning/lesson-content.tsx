/** Affiche le contenu texte d'une leçon : paragraphes, listes à puces et `code`. */
function inline(text: string) {
  const parts = text.split(/(`[^`]+`)/g);
  return parts.map((part, index) =>
    part.startsWith("`") && part.endsWith("`") ? (
      <code key={index} className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[0.9em] text-violet-600">
        {part.slice(1, -1)}
      </code>
    ) : (
      <span key={index}>{part}</span>
    ),
  );
}

export function LessonContent({ content }: { content: string }) {
  const blocks = content.split(/\n\s*\n/).filter((block) => block.trim());
  return (
    <div className="space-y-4 text-[15px] leading-relaxed text-ink/90">
      {blocks.map((block, index) => {
        const lines = block.split("\n").filter(Boolean);
        if (lines.every((line) => line.trim().startsWith("- "))) {
          return (
            <ul key={index} className="space-y-1.5 pl-1">
              {lines.map((line) => (
                <li key={line} className="flex gap-2.5">
                  <span className="mt-2.5 size-1.5 shrink-0 rounded-full bg-brand-600" />
                  <span>{inline(line.trim().slice(2))}</span>
                </li>
              ))}
            </ul>
          );
        }
        return <p key={index}>{inline(lines.join(" "))}</p>;
      })}
    </div>
  );
}

export function CodeBlock({ code }: { code: string }) {
  return (
    <pre className="scrollbar-thin overflow-x-auto rounded-xl bg-[#0B1220] p-4 font-mono text-[14px] leading-relaxed text-indigo-200">
      <code>{code}</code>
    </pre>
  );
}
