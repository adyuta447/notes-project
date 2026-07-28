import {
  getAddress,
  getNetworkDetails,
  isConnected,
  setAllowed,
  signTransaction,
} from "@stellar/freighter-api";
import {
  Asset,
  BASE_FEE,
  Contract,
  Horizon,
  Networks,
  Operation,
  StrKey,
  nativeToScVal,
  rpc,
  TransactionBuilder,
} from "@stellar/stellar-sdk";

export const CONTRACT_ID =
  import.meta.env.VITE_CONTRACT_ID ??
  "CBLU4IUASQ4WUMOXBFLZRSBBLILGOH33GS4LUPKFBCCCMJCDQNMF7G2M";
export const RPC_URL =
  import.meta.env.VITE_RPC_URL ?? "https://soroban-testnet.stellar.org";
export const HORIZON_URL =
  import.meta.env.VITE_HORIZON_URL ?? "https://horizon-testnet.stellar.org";
export const NETWORK_PASSPHRASE = Networks.TESTNET;

export type Wallet = {
  address: string;
  network: string;
};

function assertNoWalletError(result: { error?: string }, fallback: string) {
  if (result.error) {
    throw new Error(result.error || fallback);
  }
}

/**
 * Requests Freighter permission and returns the currently selected address.
 * Calling setAllowed is important: modern Freighter versions refuse signing
 * requests from dapps that have not completed the connection flow.
 */
export async function connectWallet(): Promise<Wallet> {
  const connection = await isConnected();
  assertNoWalletError(connection, "Unable to check Freighter.");

  if (!connection.isConnected) {
    throw new Error(
      "Freighter is not installed. Install the browser extension and try again.",
    );
  }

  const permission = await setAllowed();
  assertNoWalletError(permission, "Freighter permission was not granted.");
  if (!permission.isAllowed) {
    throw new Error("Wallet access was declined.");
  }

  const account = await getAddress();
  assertNoWalletError(account, "Unable to read the wallet address.");
  if (!account.address) {
    throw new Error("Freighter did not return an active address.");
  }

  const network = await getNetworkDetails();
  assertNoWalletError(network, "Unable to read the selected network.");

  if (network.networkPassphrase !== NETWORK_PASSPHRASE) {
    throw new Error("Please switch Freighter to Testnet, then connect again.");
  }

  return {
    address: account.address,
    network: network.network || "TESTNET",
  };
}

/**
 * Builds a Soroban invocation, prepares it with RPC, asks Freighter to sign
 * the XDR, and submits the signed transaction to Stellar Testnet.
 */
export async function createNote(
  address: string,
  title: string,
  content: string,
): Promise<string> {
  const server = new rpc.Server(RPC_URL);
  const source = await server.getAccount(address);
  const contract = new Contract(CONTRACT_ID);

  const transaction = new TransactionBuilder(source, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(
      contract.call(
        "create_note",
        nativeToScVal(title, { type: "string" }),
        nativeToScVal(content, { type: "string" }),
      ),
    )
    .setTimeout(30)
    .build();

  const prepared = await server.prepareTransaction(transaction);
  const signed = await signTransaction(prepared.toXDR(), {
    address,
    networkPassphrase: NETWORK_PASSPHRASE,
  });
  assertNoWalletError(signed, "The transaction was not signed.");
  if (!signed.signedTxXdr) {
    throw new Error("Freighter did not return a signed transaction.");
  }

  const signedTransaction = TransactionBuilder.fromXDR(
    signed.signedTxXdr,
    NETWORK_PASSPHRASE,
  );
  const submission = await server.sendTransaction(signedTransaction);

  if (submission.status !== "PENDING") {
    throw new Error(`Stellar rejected the transaction (${submission.status}).`);
  }

  const result = await server.pollTransaction(submission.hash, {
    attempts: 20,
    sleepStrategy: () => 1000,
  });

  if (result.status !== "SUCCESS") {
    throw new Error(`Transaction did not succeed (${result.status}).`);
  }

  return submission.hash;
}

/**
 * Reads the account's native XLM balance from Horizon. Accounts that have
 * never been funded do not exist yet, so that case is reported explicitly
 * instead of surfacing Horizon's 404.
 */
export async function getXlmBalance(address: string): Promise<string> {
  const horizon = new Horizon.Server(HORIZON_URL);

  try {
    const account = await horizon.loadAccount(address);
    const native = account.balances.find(
      (balance) => balance.asset_type === "native",
    );
    return native?.balance ?? "0";
  } catch (error) {
    const status = (error as { response?: { status?: number } }).response
      ?.status;
    if (status === 404) {
      throw new Error(
        "Account not found on Testnet. Fund it with Friendbot first.",
      );
    }
    throw error;
  }
}

/**
 * Builds a classic Stellar payment operation (native XLM transfer), asks
 * Freighter to sign it, and submits it through Stellar RPC.
 */
export async function sendPayment(
  address: string,
  destination: string,
  amount: string,
): Promise<string> {
  if (!StrKey.isValidEd25519PublicKey(destination)) {
    throw new Error("Enter a valid Stellar public address (starts with G).");
  }
  if (!Number.isFinite(Number(amount)) || Number(amount) <= 0) {
    throw new Error("Enter an amount greater than 0.");
  }

  const server = new rpc.Server(RPC_URL);
  const source = await server.getAccount(address);

  const transaction = new TransactionBuilder(source, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(
      Operation.payment({
        destination,
        asset: Asset.native(),
        amount,
      }),
    )
    .setTimeout(30)
    .build();

  const signed = await signTransaction(transaction.toXDR(), {
    address,
    networkPassphrase: NETWORK_PASSPHRASE,
  });
  assertNoWalletError(signed, "The transaction was not signed.");
  if (!signed.signedTxXdr) {
    throw new Error("Freighter did not return a signed transaction.");
  }

  const signedTransaction = TransactionBuilder.fromXDR(
    signed.signedTxXdr,
    NETWORK_PASSPHRASE,
  );
  const submission = await server.sendTransaction(signedTransaction);

  if (submission.status !== "PENDING") {
    throw new Error(`Stellar rejected the transaction (${submission.status}).`);
  }

  const result = await server.pollTransaction(submission.hash, {
    attempts: 20,
    sleepStrategy: () => 1000,
  });

  if (result.status !== "SUCCESS") {
    throw new Error(`Transaction did not succeed (${result.status}).`);
  }

  return submission.hash;
}
