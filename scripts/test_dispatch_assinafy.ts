import { createClient } from "@supabase/supabase-js";

const url = "https://xdqgglrxidmegujhkygj.supabase.co";
const key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhkcWdnbHJ4aWRtZWd1amhreWdqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc5MjA1ODYsImV4cCI6MjA5MzQ5NjU4Nn0.RXTdfcAvprj39bgoLUYuKxHao4q1ArdXxbKwG9k7ors";

const supabase = createClient(url, key);

const samplePdfBase64 = "JVBERi0xLjQKMSAwIG9iago8PAovVHlwZSAvQ2F0YWxvZwovUGFnZXMgMiAwIFIKPj4KZW5kb2JqCjIgMCBvYmoKPDAKL1R5cGUgL1BhZ2VzCi9Db3VudCAxCi9LaWRzIFszIDAgUl0KPj4KZW5kb2JqCjMgMCBvYmoKPDAKL1R5cGUgL1BhZ2UKL1BhcmVudCAyIDAgUgovTWVkaWFCb3ggWzAgMCA2MTIgNzkyXQo+PgplbmRvYmoKdHJhaWxlcgo8PAovUm9vdCAxIDAgUgo+PgpzdGFydHhyZWYKMTczCiUlRU9G";

async function computeSha256(base64: string): Promise<string> {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const buffer = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function main() {
  const contractId = "9fe09339-4a4e-4abc-b7c6-d482a2e0fb2f";
  const validPdfHash = await computeSha256(samplePdfBase64);

  console.log("\n=======================================================");
  console.log("TESTING UNAUTHENTICATED DISPATCH (EXPECTED HTTP 401)");
  console.log("=======================================================");
  console.log("Valid PDF Hash (64 hex chars):", validPdfHash);

  const { data: res, error: err } = await supabase.functions.invoke("assinafy-create-doc", {
    body: {
      contractId,
      pdfBase64: samplePdfBase64,
      pdfHash: validPdfHash,
    },
  });

  let status: number | undefined;
  let body: any = null;

  if (err && (err as any).context) {
    status = (err as any).context.status;
    try {
      body = await (err as any).context.json();
    } catch {}
  } else if (res) {
    body = res;
    status = 200;
  }

  console.log("HTTP Status Received:", status);
  console.log("Response Body Received:", JSON.stringify(body, null, 2));

  const expectedStatus = 401;
  const expectedCode = "authentication_required";
  const authRejected = Boolean(body?.diagnostic?.authenticationRejected);

  if (status === expectedStatus && body?.code === expectedCode && authRejected) {
    console.log("SUCCESS: Received expected HTTP 401 with code 'authentication_required' and authenticationRejected: true.");
    process.exit(0);
  } else {
    console.error(`FAILURE: Expected HTTP ${expectedStatus} with code '${expectedCode}' and authenticationRejected: true, but got status ${status} with body:`, body);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
