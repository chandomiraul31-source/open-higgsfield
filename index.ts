// Seedance 2.5 text-to-video through the official Higgsfield SDK.
// Run: pnpm seedance   (reads HF_CREDENTIALS from .env.local, server-side only)
import { config as loadEnv } from "dotenv";
import { createHiggsfieldClient } from "@higgsfield/client/v2";

loadEnv({ path: ".env.local", quiet: true });

const MODEL = "bytedance/seedance-2.5/text-to-video";

async function main() {
  const credentials = process.env.HF_CREDENTIALS;
  if (!credentials) {
    throw new Error("HF_CREDENTIALS is not set. Add it to .env.local as key-id:key-secret.");
  }

  const client = createHiggsfieldClient({
    credentials,
    // Video runs outlast the SDK's 5-minute default poll window.
    maxPollTime: 15 * 60 * 1000,
    pollInterval: 4000,
  });

  console.info(`Submitting ${MODEL}…`);
  // v2 subscribe resolves with the raw request status: { status, request_id, video?, images? }.
  const result = await client.subscribe(MODEL, {
    input: {
      prompt: "A cinematic scene at sunset",
      // Lowest-cost settings Seedance 2.5 accepts: 480p, 4 s, no audio track.
      duration: 4,
      resolution: "480p",
      aspect_ratio: "16:9",
      generate_audio: false,
    },
    withPolling: true,
  });

  // Widened to string: the API can also report "canceled", which the SDK's type omits.
  const status: string = result.status;
  const id = result.request_id;
  if (status === "nsfw") throw new Error(`Request ${id} was rejected by moderation (nsfw).`);
  if (status === "failed") throw new Error(`Request ${id} failed.`);
  if (status === "canceled") throw new Error(`Request ${id} was canceled.`);
  if (status !== "completed") throw new Error(`Request ${id} ended with status "${status}".`);

  const url = result.video?.url;
  if (!url) throw new Error(`Request ${id} completed but returned no video URL.`);

  console.log(`Video URL: ${url}`);
}

main().catch((error: unknown) => {
  // Report the SDK's message only; never dump the error object, which can carry request headers.
  const name = error instanceof Error ? error.name : "Error";
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Generation did not succeed — ${name}: ${message}`);
  process.exitCode = 1;
});
