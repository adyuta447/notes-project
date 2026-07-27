import {
  getAddress,
  getNetworkDetails,
  isConnected,
  setAllowed,
  signTransaction,
} from "@stellar/freighter-api";
import {
  BASE_FEE,
  Contract,
  Networks,
  nativeToScVal,
  rpc,
  TransactionBuilder,
} from "@stellar/stellar-sdk";

export const CONTRACT_ID =
  import.meta.env.VITE_CONTRACT_ID ??
  "CBLU4IUASQ4WUMOXBFLZRSBBLILGOH33GS4LUPKFBCCCMJCDQNMF7G2M";
export const RPC_URL =
  import.meta.env.VITE_RPC_URL ?? "https://soroban-testnet.stellar.org";
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
