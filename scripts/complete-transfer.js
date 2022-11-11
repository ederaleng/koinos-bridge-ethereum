// npx hardhat run --network localhost scripts/deploy.js
const { ethers } = require('hardhat')

const BRIDGE_ADDRESS = '0x5FbDB2315678afecb367f032d93F642f64180aa3'

async function main () {
  const accounts = await ethers.getSigners()

  const Bridge = await ethers.getContractFactory('Bridge')
  const bridge = Bridge.attach(BRIDGE_ADDRESS)

  const koinosTxId = '0x12207638d5874c57ff042d9268927f79c8cd151d3ff0f94b2e366d154cc1c2d9807f'
  const koinosTxIdOp = '1'
  const tokenAddress = '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512'
  const recipient = '0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65'
  const amount = '2500'
  const expiration = '1668180684688'
  const signatures = [
    '0x2ae0ce479d8179d5f685b844acbcbfd71d06aae6501583ee039ba8b2c7ef718472a3adf0dfb9836a6f9d88d3b9a802a25795cf19d094d762bc258a0d34f4ed951c',
    '0xd55c5626e163a245297f9566d0626327f04d58f1cf8ed5acc1cfc55d4d9e760f0bf1f13af9e5b14fe512fc0eab67300a799b3ea9671e1eaceb5bd4f219df1d541b',
    '0x9ff851edf43aa15018b07541028b494d33fdda116f6c2e9e3830bac73f68cc3527850823f2f4f8c87f2d460834374e0e9db13b5733a920d5a2e2ff0e484b1d321c'
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
