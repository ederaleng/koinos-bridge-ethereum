// npx hardhat run --network localhost scripts/deploy.js
const { ethers } = require('hardhat')

const BRIDGE_ADDRESS = '0x5FbDB2315678afecb367f032d93F642f64180aa3'

async function main () {
  const accounts = await ethers.getSigners()

  const Bridge = await ethers.getContractFactory('Bridge')
  const bridge = Bridge.attach(BRIDGE_ADDRESS)

  const ethTxId = '0xc4519e2c82831a2760bd3fbbdef9b2e946c865ed2a8558ea6fe6f9c4b883c73d'
  const tx = await bridge.connect(accounts[10]).RequestNewSignatures(ethTxId)

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
