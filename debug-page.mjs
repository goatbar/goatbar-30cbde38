import puppeteer from 'puppeteer';

(async () => {
  try {
    const browser = await puppeteer.launch({ headless: "new" });
    const page = await browser.newPage();
    await page.goto('http://localhost:5173/login', { waitUntil: 'networkidle0', timeout: 10000 });

    const inputRect = await page.evaluate(() => {
      const input = document.querySelector('input[type="email"]');
      if (!input) return null;
      const rect = input.getBoundingClientRect();
      return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
    });

    if (inputRect) {
      const blockingElement = await page.evaluate(({ x, y }) => {
        const el = document.elementFromPoint(x, y);
        if (!el) return null;
        return {
          tagName: el.tagName,
          className: el.className,
          id: el.id
        };
      }, inputRect);
      console.log("Blocking element:", blockingElement);
    } else {
      console.log("Email input not found.");
    }

    const images = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('img')).map(img => ({
        src: img.src,
        width: img.width,
        height: img.height,
        naturalWidth: img.naturalWidth,
        naturalHeight: img.naturalHeight,
        className: img.className
      }));
    });
    console.log("Images found:", images);

    await browser.close();
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})();
