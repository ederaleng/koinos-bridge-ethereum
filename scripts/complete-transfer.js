// npx hardhat run --network localhost scripts/deploy.js
const { ethers } = require('hardhat')

const BRIDGE_ADDRESS = '0x5FbDB2315678afecb367f032d93F642f64180aa3'

async function main() {
  const accounts = await ethers.getSigners()

  const Bridge = await ethers.getContractFactory('Bridge')
  const bridge = Bridge.attach(BRIDGE_ADDRESS)

  const koinosTxId = '0x122030cf28aab09b600f1239b258d3e094377cca67dc7ea4ff677d7de907ff49e2b9'
  const koinosTxIdOp = '1'
  const tokenAddress = '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512'
  const recipient = '0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65'
  const amount = '2500'
  const expiration = '1668132984000'
  const signatures = [
    "0x43592a7038fe7d59ab4826694e5bea21d4e9dd5a5ae726190ff7551f2c426cb27de5ee6ee669ece8b57680c3b7f9f1c6744e72a9c7dfa59e544ac7f2def0239a1b",
    "0xac0999e416e6b8741ba3478349d15075fe5b105c251133e15a887481396797423b49e950f7aed3c8df872e6e999d49c444eb84e1e326d32358ed10e6b631c4331c",
    "0xcec4572b06624075df06873d622426963165dd7e4fce0e87192a59de3e89141e10f774a007ee1cbe79d161695becd720ddfa1145606e59de095a40f0a225536c1c"
  ]
  const tx = await bridge.connect(accounts[10]).completeTransfer(koinosTxId, koinosTxIdOp, tokenAddress, recipient, amount, signatures, expiration)
  await tx.wait()
  console.log(tx)
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  // .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
