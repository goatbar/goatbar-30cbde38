import fs from "node:fs";
import path from "node:path";

const srcDir = "c:\\Goatbar-system\\Fotos dos Drinks";
const destDir = "c:\\Goatbar-system\\public\\drinks";

if (!fs.existsSync(destDir)) {
  fs.mkdirSync(destDir, { recursive: true });
}

const mapping = {
  "Aperol Spritz.PNG": "aperol-spritz.png",
  "Apple Martini.PNG": "apple-martini.png",
  "Aquário.jpg": "aquario.jpg",
  "Bossa Nova.png": "bossa-nova.png",
  "Bramble.jpeg": "bramble.jpeg",
  "Caipi Abacaxi com Raspas de Limão Siciliano.PNG": "caipi-abacaxi.png",
  "Caipi Limão, Cravo e Mel.PNG": "caipi-limao-cravo-mel.png",
  "Caipi Limão.PNG": "caipi-limao.png",
  "Caipi Maracujá & Baunilha.png": "caipi-maracuja-baunilha.png",
  "Caipi Morango.PNG": "caipi-morango.png",
  "Cosmopolitan.jpeg": "cosmopolitan.jpeg",
  "C’est La Vie.PNG": "cest-la-vie.png",
  "Expresso Martini.PNG": "expresso-martini.png",
  "Fitzgerald.png": "fitzgerald.png",
  "Gin & Tônica.PNG": "gin-tonica.png",
  "Gin Morango.PNG": "gin-morango.png",
  "Gin Tropical.PNG": "gin-tropical.png",
  "Mint Julep.png": "mint-julep.png",
  "Mojito.PNG": "mojito.png",
  "Moscow Mule.PNG": "moscow-mule.png",
  "Negroni.png": "negroni.png",
  "Old Fashioned.png": "old-fashioned.png",
  "Olho Grego.jpeg": "olho-grego.jpeg",
  "Paloma.jpeg": "paloma.jpeg",
  "Sex on the Beach.PNG": "sex-on-the-beach.png",
  "Soda Italiana.png": "soda-italiana.png",
  "Stamping Passion.JPG": "stamping-passion.jpg",
  "Tom Collins.png": "tom-collins.png",
  "Whisky Sour.png": "whisky-sour.png"
};

const copied = [];
for (const [srcFile, destFile] of Object.entries(mapping)) {
  const srcPath = path.join(srcDir, srcFile);
  const destPath = path.join(destDir, destFile);
  if (fs.existsSync(srcPath)) {
    fs.copyFileSync(srcPath, destPath);
    copied.push({ srcFile, destFile, size: fs.statSync(destPath).size });
  } else {
    console.warn("Source not found:", srcFile);
  }
}
console.log(`Copied ${copied.length} files successfully.`);
