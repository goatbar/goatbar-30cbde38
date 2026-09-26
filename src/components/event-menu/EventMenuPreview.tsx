import type { EventMenuModel } from "@/lib/event-menu";

export function EventMenuPreview({ menu }: { menu: EventMenuModel }) {
  return (
    <div className="mx-auto aspect-[210/297] w-full max-w-[520px] overflow-hidden rounded-[28px] bg-[#f3e1e1] shadow-xl">
      <div className="relative h-full px-[10%] pt-[11%] pb-[13%]">
        <div className="absolute inset-x-[7%] top-0 h-[18%] rounded-b-[999px] bg-[#fffdf9]" />
        <div className="relative z-10 flex h-full flex-col">
          <h2 className="text-center font-display text-[clamp(30px,5vw,48px)] font-semibold text-[#7b1f2c]">Menu</h2>
          <div className={"mt-[8%] grid flex-1 content-start text-center " + (menu.columns === 2 ? "grid-cols-2 gap-x-8" : "grid-cols-1") + (menu.layout === "compact" ? " gap-y-2" : menu.layout === "standard" ? " gap-y-3" : " gap-y-5")}>
            {menu.drinks.map((drink) => (
              <div key={drink.id} className="break-inside-avoid">
                <div className="font-display text-[clamp(12px,2vw,18px)] font-semibold text-[#7b1f2c]">{drink.name}</div>
                {drink.description && <div className="mx-auto mt-1 max-w-[230px] text-[clamp(8px,1.25vw,11px)] leading-snug text-[#383332]">{drink.description}</div>}
              </div>
            ))}
          </div>
          <div className="min-h-[12%] text-center text-[#7b1f2c]">
            {menu.subtitle && <div className="font-display text-[clamp(15px,2.5vw,24px)]">{menu.subtitle}</div>}
          </div>
          <div className="mt-auto border-t border-[#7b1f2c]/20 pt-3 text-center text-[10px] font-semibold tracking-[0.28em] text-[#7b1f2c]">GOAT BAR</div>
        </div>
      </div>
    </div>
  );
}
