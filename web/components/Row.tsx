import PosterCard from "@/components/PosterCard";
import type { Feature } from "@/lib/feature";

export default function Row({ id, title, items, wide = false }: { id: string; title: string; items: Feature[]; wide?: boolean }) {
  if (!items.length) return null;
  return (
    <section id={id} aria-labelledby={`${id}-h`} className="scroll-mt-8 px-5 md:px-14">
      <h2 id={`${id}-h`} className="mb-4 text-xl font-bold tracking-tight md:text-2xl">
        {title}
      </h2>
      <ul className="no-scrollbar -mx-2 flex snap-x scroll-px-2 gap-4 overflow-x-auto px-2 pt-2 pb-6 [perspective:900px] md:-mr-14 md:pr-14">
        {items.map((f) => (
          <li key={f.id} className="snap-start">
            <PosterCard feature={f} wide={wide} />
          </li>
        ))}
      </ul>
    </section>
  );
}
