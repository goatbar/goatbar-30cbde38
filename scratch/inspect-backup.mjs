import fs from "fs";

const data = JSON.parse(fs.readFileSync("goatbar-localstorage-backup (1).json", "utf8"));

// Check what keys are in data
console.log("Top level keys in backup:", Object.keys(data));

// The backup seems to store stringified JSON under keys like 'goatbar-functional-store-v10' or similar.
for (const key of Object.keys(data)) {
  const content = data[key];
  if (typeof content === "string") {
    try {
      const parsed = JSON.parse(content);
      console.log(`\nKey: ${key}`);
      console.log("Parsed keys:", Object.keys(parsed));
      if (parsed.financialSessions) {
        console.log(`Number of financialSessions: ${parsed.financialSessions.length}`);
        console.log(
          "Sample financialSession:",
          JSON.stringify(parsed.financialSessions[0], null, 2),
        );
        const modalities = new Set(parsed.financialSessions.map((s) => s.modalidade || s.modality));
        console.log("Unique modalities in sessions:", Array.from(modalities));
      }
      if (parsed.eventos) {
        console.log(`Number of eventos: ${parsed.eventos.length}`);
        console.log("Sample evento:", JSON.stringify(parsed.eventos[0], null, 2));
      }
      if (parsed.inventoryItems) {
        console.log(`Number of inventoryItems: ${parsed.inventoryItems.length}`);
        console.log("Sample inventoryItem:", JSON.stringify(parsed.inventoryItems[0], null, 2));
      }
    } catch (e) {
      console.log(`Key ${key} is string but not valid JSON: ${e.message}`);
    }
  } else {
    console.log(`Key ${key} is of type ${typeof content}`);
  }
}
