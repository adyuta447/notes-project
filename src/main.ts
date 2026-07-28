import "./styles.css";
import {
  connectWallet,
  CONTRACT_ID,
  createNote,
  getXlmBalance,
  sendPayment,
  type Wallet,
} from "./stellar";

const app = document.querySelector<HTMLDivElement>("#app");
if (!app) throw new Error("App root was not found.");

let wallet: Wallet | null = null;
let busy = false;

const short = (value: string) =>
  value.length > 14 ? `${value.slice(0, 7)}…${value.slice(-5)}` : value;

const explorerLink = (hash: string) =>
  `https://stellar.expert/explorer/testnet/tx/${hash}`;

app.innerHTML = `
  <header class="nav">
    <a class="brand" href="/" aria-label="Stellar Notes home">
      <span class="brand-mark">✦</span>
      <span>Stellar Notes</span>
    </a>
    <div class="wallet-area">
      <span class="balance-chip" id="balance-chip" hidden>
        <span class="balance-label">Balance</span>
        <span id="balance-value">-- XLM</span>
      </span>
      <button class="wallet-button" id="connect-wallet" type="button">
        <span class="wallet-dot"></span>
        <span id="wallet-label">Connect wallet</span>
      </button>
      <button class="disconnect-button" id="disconnect-wallet" type="button" hidden>
        Disconnect
      </button>
    </div>
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

    <section class="workspace">
      <div class="panel">
        <div class="panel-heading">
          <div>
            <p class="kicker">SEND PAYMENT</p>
            <h2>Send XLM</h2>
          </div>
          <span class="step">02</span>
        </div>

        <form id="payment-form">
          <label for="destination">Destination address</label>
          <input id="destination" name="destination"
            placeholder="G..." required />

          <label for="amount">Amount (XLM)</label>
          <input id="amount" name="amount" type="number" min="0.0000001"
            step="0.0000001" placeholder="10" required />

          <button class="primary-button" id="send-payment" type="submit" disabled>
            <span id="send-label">Connect wallet to continue</span>
            <span aria-hidden="true">↗</span>
          </button>
        </form>
        <div id="payment-status" class="status" role="status" aria-live="polite"></div>
      </div>

      <aside>
        <p class="kicker">ABOUT THIS TRANSFER</p>
        <ol class="steps">
          <li>
            <span>01</span>
            <div><strong>Native XLM</strong><p>A classic Stellar payment operation, sent directly between two accounts.</p></div>
          </li>
          <li>
            <span>02</span>
            <div><strong>Testnet only</strong><p>Uses Testnet lumens, which have no real-world value.</p></div>
          </li>
          <li>
            <span>03</span>
            <div><strong>Confirmed on-chain</strong><p>The app polls Stellar until the network confirms the transfer.</p></div>
          </li>
        </ol>
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
const disconnectButton =
  document.querySelector<HTMLButtonElement>("#disconnect-wallet")!;
const walletLabel = document.querySelector<HTMLSpanElement>("#wallet-label")!;
const balanceChip = document.querySelector<HTMLSpanElement>("#balance-chip")!;
const balanceValue = document.querySelector<HTMLSpanElement>("#balance-value")!;

const noteForm = document.querySelector<HTMLFormElement>("#note-form")!;
const saveButton = document.querySelector<HTMLButtonElement>("#save-note")!;
const saveLabel = document.querySelector<HTMLSpanElement>("#save-label")!;
const status = document.querySelector<HTMLDivElement>("#status")!;

const paymentForm = document.querySelector<HTMLFormElement>("#payment-form")!;
const sendButton = document.querySelector<HTMLButtonElement>("#send-payment")!;
const sendLabel = document.querySelector<HTMLSpanElement>("#send-label")!;
const paymentStatus =
  document.querySelector<HTMLDivElement>("#payment-status")!;

function setStatusText(
  el: HTMLElement,
  message: string,
  kind: "info" | "error" | "success",
) {
  el.textContent = message;
  el.className = `status visible ${kind}`;
}

function setStatusHtml(
  el: HTMLElement,
  html: string,
  kind: "info" | "error" | "success",
) {
  el.innerHTML = html;
  el.className = `status visible ${kind}`;
}

function updateControls() {
  const connected = Boolean(wallet);

  connectButton.disabled = busy || connected;
  disconnectButton.hidden = !connected;
  disconnectButton.disabled = busy;
  balanceChip.hidden = !connected;

  walletLabel.textContent = wallet ? short(wallet.address) : "Connect wallet";
  connectButton.classList.toggle("connected", connected);

  saveButton.disabled = busy || !connected;
  saveLabel.textContent = busy
    ? "Waiting for Freighter…"
    : connected
      ? "Sign & save on Stellar"
      : "Connect wallet to continue";

  sendButton.disabled = busy || !connected;
  sendLabel.textContent = busy
    ? "Waiting for Freighter…"
    : connected
      ? "Sign & send XLM"
      : "Connect wallet to continue";
}

async function refreshBalance() {
  if (!wallet) return;
  try {
    const balance = await getXlmBalance(wallet.address);
    balanceValue.textContent = `${balance} XLM`;
  } catch {
    balanceValue.textContent = "unavailable";
  }
}

connectButton.addEventListener("click", async () => {
  if (wallet || busy) return;
  busy = true;
  updateControls();
  setStatusText(status, "Check Freighter to approve this connection.", "info");

  try {
    wallet = await connectWallet();
    setStatusText(
      status,
      `Connected ${short(wallet.address)} on ${wallet.network}.`,
      "success",
    );
    await refreshBalance();
  } catch (error) {
    wallet = null;
    setStatusText(
      status,
      error instanceof Error ? error.message : "Wallet connection failed.",
      "error",
    );
  } finally {
    busy = false;
    updateControls();
  }
});

disconnectButton.addEventListener("click", () => {
  // Freighter doesn't expose a revoke API — the connection permission lives
  // inside the extension. Disconnecting just clears this dapp's own session.
  wallet = null;
  balanceValue.textContent = "-- XLM";
  setStatusText(
    status,
    "Wallet disconnected. Revoke access from the Freighter extension if you want to fully forget this site.",
    "info",
  );
  updateControls();
});

noteForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!wallet || busy) return;

  const data = new FormData(noteForm);
  const title = String(data.get("title") ?? "").trim();
  const content = String(data.get("content") ?? "").trim();
  if (!title || !content) return;

  busy = true;
  updateControls();
  setStatusText(
    status,
    "Review and approve the transaction in Freighter.",
    "info",
  );

  try {
    const hash = await createNote(wallet.address, title, content);
    noteForm.reset();
    setStatusHtml(
      status,
      `Note saved. Transaction: ${short(hash)} — <a href="${explorerLink(hash)}" target="_blank" rel="noopener noreferrer">view on Stellar Expert</a>`,
      "success",
    );
    await refreshBalance();
  } catch (error) {
    setStatusText(
      status,
      error instanceof Error ? error.message : "Transaction failed.",
      "error",
    );
  } finally {
    busy = false;
    updateControls();
  }
});

paymentForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!wallet || busy) return;

  const data = new FormData(paymentForm);
  const destination = String(data.get("destination") ?? "").trim();
  const amount = String(data.get("amount") ?? "").trim();
  if (!destination || !amount) return;

  busy = true;
  updateControls();
  setStatusText(
    paymentStatus,
    "Review and approve the payment in Freighter.",
    "info",
  );

  try {
    const hash = await sendPayment(wallet.address, destination, amount);
    paymentForm.reset();
    setStatusHtml(
      paymentStatus,
      `Payment sent. Transaction: ${short(hash)} — <a href="${explorerLink(hash)}" target="_blank" rel="noopener noreferrer">view on Stellar Expert</a>`,
      "success",
    );
    await refreshBalance();
  } catch (error) {
    setStatusText(
      paymentStatus,
      error instanceof Error ? error.message : "Payment failed.",
      "error",
    );
  } finally {
    busy = false;
    updateControls();
  }
});

updateControls();
