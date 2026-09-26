import React from "react";
import modeloCardapioBg from "@/assets/menu/modelo-cardapio-bg.png";
import type {
  EventMenuModel,
  EventMenuPageLayout,
  EventMenuPersonalization,
} from "@/lib/event-menu";
import { MENU_PAGE_WIDTH, MENU_PAGE_HEIGHT } from "@/lib/event-menu";

function WeddingPersonalization({
  personalization,
}: {
  personalization: Extract<EventMenuPersonalization, { kind: "wedding" }>;
}) {
  return (
    <div className="flex flex-col items-center justify-center text-center">
      {/* Monograma com iniciais reais - tamanho refinado (não gigante) */}
      <div
        className="font-serif italic text-[#701117]"
        style={{
          fontSize: "clamp(26px, 6.5cqw, 38px)",
          lineHeight: 1,
          letterSpacing: "-0.05em",
        }}
      >
        {personalization.initials}
      </div>

      {/* Nomes dos noivos / casal preservando a ordem */}
      {personalization.label && (
        <div
          className="font-sans font-medium uppercase text-[#701117]"
          style={{
            fontSize: "clamp(9px, 2.1cqw, 12px)",
            letterSpacing: "0.15em",
            marginTop: "clamp(3px, 0.7cqw, 5px)",
          }}
        >
          {personalization.label}
        </div>
      )}

      {/* Data do casamento formatada */}
      {personalization.date && (
        <div
          className="font-sans font-normal text-[#701117]/85"
          style={{
            fontSize: "clamp(8px, 1.8cqw, 10px)",
            letterSpacing: "0.22em",
            marginTop: "clamp(2px, 0.5cqw, 3px)",
          }}
        >
          {personalization.date}
        </div>
      )}
    </div>
  );
}

function BirthdayPersonalization({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center text-center">
      <svg
        viewBox="0 0 240 70"
        className="h-[clamp(36px,9cqw,56px)] w-auto fill-[#701117]"
        aria-label="Happy Birthday"
      >
        <text
          x="120"
          y="32"
          textAnchor="middle"
          fontFamily="'Brush Script MT', 'Great Vibes', 'Caveat', cursive"
          fontSize="36"
          fontStyle="italic"
        >
          Happy
        </text>
        <text
          x="120"
          y="62"
          textAnchor="middle"
          fontFamily="'Brush Script MT', 'Great Vibes', 'Caveat', cursive"
          fontSize="36"
          fontStyle="italic"
        >
          Birthday
        </text>
      </svg>
      {label && label !== "Happy Birthday" && (
        <div
          className="mt-1 font-sans text-[clamp(9px,2cqw,11px)] font-medium uppercase tracking-[0.14em] text-[#701117]"
        >
          {label}
        </div>
      )}
    </div>
  );
}

function CorporatePersonalization({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center text-center text-[#701117]">
      <svg
        viewBox="0 0 48 36"
        className="h-[clamp(24px,5.5cqw,34px)] w-auto stroke-[#701117] stroke-[1.6] fill-none"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {/* Taça 1 inclinada para brinde */}
        <path d="M14 6 L22 18 L22 28 M18 28 L26 28 M11 6 L25 6" />
        {/* Taça 2 inclinada */}
        <path d="M34 6 L26 18 L26 28 M22 28 L30 28 M23 6 L37 6" />
        {/* Brilho do brinde */}
        <circle cx="24" cy="11" r="1.5" className="fill-[#701117]" />
        <path d="M24 7 L24 4 M27 10 L30 9 M24 15 L24 17 M20 11 L18 11" strokeWidth="1" />
      </svg>
      <div
        className="mt-1 font-sans font-medium uppercase text-[#701117]"
        style={{
          fontSize: "clamp(9px, 2.1cqw, 12px)",
          letterSpacing: "0.15em",
        }}
      >
        {label || "Cheers!"}
      </div>
    </div>
  );
}

function BachelorPersonalization({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center text-center text-[#701117]">
      <div
        className="font-sans font-black uppercase text-[#701117]"
        style={{
          fontSize: "clamp(18px, 4.8cqw, 28px)",
          letterSpacing: "0.08em",
          lineHeight: 1,
        }}
      >
        {label || "GAME OVER"}
      </div>
      <div className="mt-1 flex items-center gap-1 text-[clamp(8px,1.8cqw,10px)] uppercase tracking-[0.2em] text-[#701117]/80">
        <span>•</span>
        <span>Game Over</span>
        <span>•</span>
      </div>
    </div>
  );
}

function GenericPersonalization({ label }: { label: string }) {
  if (!label) return null;
  return (
    <div
      className="font-sans font-medium uppercase text-[#701117]"
      style={{
        fontSize: "clamp(10px, 2.4cqw, 14px)",
        letterSpacing: "0.16em",
      }}
    >
      {label}
    </div>
  );
}

function PersonalizationRenderer({
  personalization,
  artworkUrl,
}: {
  personalization: EventMenuPersonalization | null;
  artworkUrl?: string | null;
}) {
  if (artworkUrl) {
    return (
      <img
        src={artworkUrl}
        alt="Arte personalizada do evento"
        className="mx-auto max-h-[clamp(50px,12cqw,75px)] max-w-[80%] object-contain"
        style={{ mixBlendMode: "multiply" }}
      />
    );
  }

  if (!personalization) return null;

  if (personalization.kind === "wedding") {
    return <WeddingPersonalization personalization={personalization} />;
  }
  if (personalization.kind === "birthday") {
    return <BirthdayPersonalization label={personalization.label} />;
  }
  if (personalization.kind === "corporate") {
    return <CorporatePersonalization label={personalization.label} />;
  }
  if (personalization.kind === "bachelor") {
    return <BachelorPersonalization label={personalization.label} />;
  }
  return <GenericPersonalization label={personalization.label} />;
}

function MenuPageView({
  page,
}: {
  page: EventMenuPageLayout;
}) {
  // Proporções exatas baseadas nas dimensões oficiais 567 x 850.5 pt
  const topPercent = (page.drinksTop / MENU_PAGE_HEIGHT) * 100;
  const heightPercent = (page.availableHeight / MENU_PAGE_HEIGHT) * 100;
  const paddingPercent = (page.topPadding / MENU_PAGE_HEIGHT) * 100;
  const gapPercent = (page.gap / MENU_PAGE_HEIGHT) * 100;

  return (
    <div
      className="@container relative mx-auto w-full max-w-[567px] overflow-hidden rounded-sm shadow-xl select-none"
      style={{
        aspectRatio: `${MENU_PAGE_WIDTH} / ${MENU_PAGE_HEIGHT}`,
        backgroundImage: `url(${modeloCardapioBg})`,
        backgroundSize: "100% 100%",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
      }}
    >
      {/* Zona útil dos drinks (sobreposta ao template oficial) */}
      <div
        className="absolute left-1/2 flex -translate-x-1/2 flex-col items-center text-center"
        style={{
          top: `${topPercent}%`,
          width: "77.6%", // 440pt / 567pt
          height: `${heightPercent}%`,
          paddingTop: `${paddingPercent}%`,
          rowGap: `${gapPercent}%`,
        }}
      >
        {page.drinks.map((drink) => (
          <div key={drink.id} className="w-full text-center">
            {/* Nome do drink: Neue Montreal Medium, tamanho 20 */}
            <h3
              className="font-medium text-[#701117]"
              style={{
                fontFamily: '"Neue Montreal", Helvetica, Arial, sans-serif',
                fontWeight: 500,
                fontSize: "clamp(13px, 3.53cqw, 20px)",
                lineHeight: "1.2",
                margin: 0,
                padding: 0,
              }}
            >
              {drink.name}
            </h3>

            {/* Descrição: Neue Montreal Regular, tamanho 16 */}
            {drink.description ? (
              <p
                className="mx-auto font-normal text-[#0f1414]"
                style={{
                  fontFamily: '"Neue Montreal", Helvetica, Arial, sans-serif',
                  fontWeight: 400,
                  fontSize: "clamp(10px, 2.82cqw, 16px)",
                  lineHeight: "1.25",
                  marginTop: "clamp(2px, 0.7cqw, 4px)",
                  marginBottom: 0,
                }}
              >
                {drink.description}
              </p>
            ) : null}
          </div>
        ))}
      </div>

      {/* Zona reservada de personalização (na última página) */}
      {page.isLastPage && (
        <div
          className="absolute left-1/2 flex -translate-x-1/2 flex-col items-center justify-center text-center"
          style={{
            top: `${(675 / MENU_PAGE_HEIGHT) * 100}%`,
            height: `${(100 / MENU_PAGE_HEIGHT) * 100}%`,
            width: "77.6%",
          }}
        >
          <PersonalizationRenderer
            personalization={page.personalization}
            artworkUrl={page.artworkUrl}
          />
        </div>
      )}

      {/* Indicador de continuação em páginas intermediárias */}
      {!page.isLastPage && (
        <div
          className="absolute left-1/2 -translate-x-1/2 font-sans font-semibold text-[#701117]/60"
          style={{
            bottom: `${(MENU_PAGE_HEIGHT - 760) / MENU_PAGE_HEIGHT * 100}%`,
            fontSize: "clamp(8px, 1.8cqw, 10px)",
            letterSpacing: "0.22em",
          }}
        >
          CONTINUA NA PÁGINA {page.pageIndex + 2}
        </div>
      )}
    </div>
  );
}

export function EventMenuPreview({ menu }: { menu: EventMenuModel }) {
  const { computedLayout } = menu;

  return (
    <div className="space-y-6">
      {computedLayout.pages.map((pageLayout) => (
        <div key={pageLayout.pageIndex} className="relative">
          {computedLayout.pages.length > 1 && (
            <div className="mb-2 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Página {pageLayout.pageIndex + 1} de {pageLayout.totalPages}
            </div>
          )}
          <MenuPageView page={pageLayout} />
        </div>
      ))}
    </div>
  );
}
