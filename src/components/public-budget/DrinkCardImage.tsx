import { useEffect, useState } from "react";
import { ImageOff } from "lucide-react";
import { resolveDrinkImage } from "@/lib/drink-image";

export function DrinkCardImage({ src, alt }: { src: string | null; alt: string }) {
  const resolved = resolveDrinkImage(src);
  const [failed, setFailed] = useState(false);

  useEffect(() => setFailed(false), [resolved]);

  if (!resolved || failed) {
    return (
      <div
        role="img"
        aria-label={`Imagem indisponível para ${alt}`}
        className="flex h-full w-full flex-col items-center justify-center gap-2 text-muted-foreground"
      >
        <ImageOff className="h-8 w-8 opacity-60" />
        <span className="text-xs">Imagem indisponível</span>
      </div>
    );
  }

  return (
    <img
      src={resolved}
      alt={alt}
      className="h-full w-full object-contain"
      onError={() => setFailed(true)}
    />
  );
}
