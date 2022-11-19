// npx hardhat run --network localhost scripts/deploy.js
const { ethers } = require('hardhat')

const BRIDGE_ADDRESS = '0x47940D3089Da6DC306678109c834718AEF23A201'

async function main () {
  const accounts = await ethers.getSigners()

  const Bridge = await ethers.getContractFactory('Bridge')
  const bridge = Bridge.attach(BRIDGE_ADDRESS)

  const ethTxId = '0x5856786bc47e4b2daa948bbc4fe7f993891c53993ea508aec39c4fa8be437e2c'
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
