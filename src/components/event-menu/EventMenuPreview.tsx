import { Instagram, Wine, Gamepad2 } from "lucide-react";
import goatbarLogo from "@/assets/goatbar-logo.png";
import type { EventMenuModel, EventMenuPersonalization } from "@/lib/event-menu";

const INSTAGRAM_QR =
  "https://api.qrserver.com/v1/create-qr-code/?size=160x160&margin=0&data=https%3A%2F%2Fwww.instagram.com%2Fgoatbar_%2F";

function Personalization({
  personalization,
  artworkUrl,
}: {
  personalization: EventMenuPersonalization;
  artworkUrl?: string | null;
}) {
  if (artworkUrl) {
    return (
      <img
        src={artworkUrl}
        alt="Arte personalizada do evento"
        className="mx-auto max-h-[92px] max-w-[72%] object-contain"
      />
    );
  }

  if (personalization.kind === "wedding") {
    return (
      <div className="leading-none">
        <div className="font-serif text-[clamp(34px,7vw,66px)] italic">
          {personalization.initials}
        </div>
        <div className="mt-1 font-serif text-[clamp(11px,2vw,17px)] uppercase tracking-[0.12em]">
          {personalization.label}
        </div>
        {personalization.date && (
          <div className="mt-2 text-[9px] tracking-[0.28em]">{personalization.date}</div>
        )}
      </div>
    );
  }

  if (personalization.kind === "birthday") {
    return (
      <div className="-rotate-3 font-serif text-[clamp(25px,5vw,46px)] italic">
        {personalization.label}
      </div>
    );
  }

  if (personalization.kind === "corporate") {
    return (
      <div className="flex flex-col items-center gap-1">
        <Wine className="h-10 w-10 stroke-[1.2]" />
        <div className="font-serif text-[clamp(15px,3vw,24px)] italic">{personalization.label}</div>
      </div>
    );
  }

  if (personalization.kind === "bachelor") {
    return (
      <div className="flex flex-col items-center gap-1">
        <Gamepad2 className="h-9 w-9 stroke-[1.2]" />
        <div className="font-serif text-[clamp(22px,4vw,38px)] font-black uppercase tracking-tight">
          {personalization.label}
        </div>
      </div>
    );
  }

  return personalization.label ? (
    <div className="font-serif text-[clamp(18px,3vw,28px)] italic">{personalization.label}</div>
  ) : null;
}

function MenuPage({
  menu,
  drinks,
  pageIndex,
  totalPages,
}: {
  menu: EventMenuModel;
  drinks: EventMenuModel["drinks"];
  pageIndex: number;
  totalPages: number;
}) {
  const isLastPage = pageIndex === totalPages - 1;
  const gap = menu.layout === "compact" ? "gap-y-[5px]" : menu.layout === "standard" ? "gap-y-[9px]" : "gap-y-[13px]";
  const titleSize = menu.layout === "compact" ? "text-[13px]" : "text-[15px]";
  const descriptionSize = menu.layout === "compact" ? "text-[8px]" : "text-[9px]";

  return (
    <div className="relative mx-auto aspect-[210/297] w-full max-w-[520px] overflow-hidden bg-[#f2dfdf] shadow-xl">
      <div className="absolute inset-x-[6.5%] top-0 h-[18%] rounded-b-[50%] bg-[#fffdf9]" />
      <div className="absolute left-[13%] right-[13%] top-[21%] bottom-[21%] rounded-[34px] bg-[#efcfd1]" />
      <div className="relative z-10 flex h-full flex-col px-[12%] pb-[5.5%] pt-[9%] text-center">
        <h2 className="font-serif text-[clamp(34px,6vw,54px)] font-normal text-[#7c2130]">Menu</h2>

        <div className={"mt-[8%] grid content-start " + gap}>
          {drinks.map((drink) => (
            <div key={drink.id} className="break-inside-avoid px-2">
              <div className={"font-serif font-semibold text-[#7c2130] " + titleSize}>
                {drink.name}
              </div>
              {drink.description && (
                <div className={"mx-auto mt-[2px] max-w-[320px] leading-[1.25] text-[#373132] " + descriptionSize}>
                  {drink.description}
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="mt-auto flex min-h-[15%] items-center justify-center pb-[2%] text-[#7c2130]">
          {isLastPage ? (
            <Personalization personalization={menu.personalization} artworkUrl={menu.artworkUrl} />
          ) : (
            <div className="text-[9px] tracking-[0.2em] text-[#7c2130]/70">
              CONTINUA
            </div>
          )}
        </div>

        <footer className="grid grid-cols-[1fr_auto_auto] items-end gap-3 border-t border-[#7c2130]/20 pt-2 text-[#7c2130]">
          <img src={goatbarLogo} alt="GOAT Bar" className="h-8 w-auto object-contain object-left" />
          <a
            href="https://www.instagram.com/goatbar_/"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1 self-center text-[8px] font-semibold tracking-wide"
          >
            <Instagram className="h-3.5 w-3.5" />
            @goatbar_
          </a>
          <img src={INSTAGRAM_QR} alt="QR Code Instagram GOAT Bar" className="h-10 w-10 bg-white p-[2px]" />
        </footer>
      </div>
    </div>
  );
}

export function EventMenuPreview({ menu }: { menu: EventMenuModel }) {
  return (
    <div className="space-y-6">
      {menu.pages.map((drinks, index) => (
        <MenuPage
          key={index}
          menu={menu}
          drinks={drinks}
          pageIndex={index}
          totalPages={menu.pages.length}
        />
      ))}
    </div>
  );
}
