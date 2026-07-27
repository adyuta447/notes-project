import "./styles.css";
import { connectWallet, CONTRACT_ID, createNote, type Wallet } from "./stellar";

const app = document.querySelector<HTMLDivElement>("#app");
if (!app) throw new Error("App root was not found.");

let wallet: Wallet | null = null;
let busy = false;

const short = (value: string) =>
  value.length > 14 ? `${value.slice(0, 7)}…${value.slice(-5)}` : value;

app.innerHTML = `
  <header class="nav">
    <a class="brand" href="/" aria-label="Stellar Notes home">
      <span class="brand-mark">✦</span>
      <span>Stellar Notes</span>
    </a>
    <button class="wallet-button" id="connect-wallet" type="button">
      <span class="wallet-dot"></span>
      <span id="wallet-label">Connect wallet</span>
    </button>
  </header>

  <main>
    <section class="hero">
      <div class="eyebrow"><span></span> ON-CHAIN NOTEBOOK</div>
      <h1>Your thoughts.<br /><em>Truly yours.</em></h1>
      <p>
        Keep notes where only you hold the key. Simple, permanent, and
        secured by the Stellar network.
      </p>
      <div class="network-pill"><span></span> Stellar Testnet</div>
    </section>

    <section class="workspace">
      <div class="panel">
        <div class="panel-heading">
          <div>
            <p class="kicker">NEW ENTRY</p>
            <h2>Write a note</h2>
          </div>
          <span class="step">01</span>
        </div>

        <form id="note-form">
          <label for="title">Title</label>
          <input id="title" name="title" maxlength="80"
            placeholder="A thought worth keeping" required />

          <label for="content">Note</label>
          <textarea id="content" name="content" maxlength="500"
            placeholder="Start writing…" required></textarea>

          <button class="primary-button" id="save-note" type="submit" disabled>
            <span id="save-label">Connect wallet to continue</span>
            <span aria-hidden="true">↗</span>
          </button>
        </form>
        <div id="status" class="status" role="status" aria-live="polite"></div>
      </div>

      <aside>
        <p class="kicker">HOW IT WORKS</p>
        <ol class="steps">
          <li>
            <span>01</span>
            <div><strong>Connect</strong><p>Authorize this dapp in Freighter.</p></div>
          </li>
          <li>
            <span>02</span>
            <div><strong>Review & sign</strong><p>Freighter shows the exact transaction.</p></div>
          </li>
          <li>
            <span>03</span>
            <div><strong>Stored on Stellar</strong><p>Your note is submitted to Testnet.</p></div>
          </li>
        </ol>
        <div class="contract-card">
          <span>SMART CONTRACT</span>
          <code title="${CONTRACT_ID}">${short(CONTRACT_ID)}</code>
        </div>
      </aside>
    </section>
  </main>

  <footer>
    <span>BUILT ON STELLAR</span>
    <span>TESTNET · SOROBAN · FREIGHTER</span>
  </footer>
`;

const connectButton =
  document.querySelector<HTMLButtonElement>("#connect-wallet")!;
const walletLabel = document.querySelector<HTMLSpanElement>("#wallet-label")!;
const form = document.querySelector<HTMLFormElement>("#note-form")!;
const saveButton = document.querySelector<HTMLButtonElement>("#save-note")!;
const saveLabel = document.querySelector<HTMLSpanElement>("#save-label")!;
const status = document.querySelector<HTMLDivElement>("#status")!;

function showStatus(message: string, kind: "info" | "error" | "success") {
  status.textContent = message;
  status.className = `status visible ${kind}`;
}

function updateControls() {
  connectButton.disabled = busy;
  saveButton.disabled = busy || !wallet;
  walletLabel.textContent = wallet ? short(wallet.address) : "Connect wallet";
  connectButton.classList.toggle("connected", Boolean(wallet));
  saveLabel.textContent = busy
    ? "Waiting for Freighter…"
    : wallet
      ? "Sign & save on Stellar"
      : "Connect wallet to continue";
}

connectButton.addEventListener("click", async () => {
  busy = true;
  updateControls();
  showStatus("Check Freighter to approve this connection.", "info");

  try {
    wallet = await connectWallet();
    showStatus(
      `Connected ${short(wallet.address)} on ${wallet.network}.`,
      "success",
    );
  } catch (error) {
    wallet = null;
    showStatus(
      error instanceof Error ? error.message : "Wallet connection failed.",
      "error",
    );
  } finally {
    busy = false;
    updateControls();
  }
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!wallet || busy) return;

  const data = new FormData(form);
  const title = String(data.get("title") ?? "").trim();
  const content = String(data.get("content") ?? "").trim();
  if (!title || !content) return;

  busy = true;
  updateControls();
  showStatus("Review and approve the transaction in Freighter.", "info");

  try {
    const hash = await createNote(wallet.address, title, content);
    form.reset();
    showStatus(`Note saved. Transaction: ${short(hash)}`, "success");
  } catch (error) {
    showStatus(
      error instanceof Error ? error.message : "Transaction failed.",
      "error",
    );
  } finally {
    busy = false;
    updateControls();
  }
});

updateControls();
