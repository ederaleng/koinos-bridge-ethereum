// npx hardhat run --network localhost scripts/deploy.js
const { ethers } = require('hardhat')

const BRIDGE_ADDRESS = '0x5FbDB2315678afecb367f032d93F642f64180aa3'
const MOCK_TOKEN_ADDRESS = '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512'
const koinosAddr1 = '1GE2JqXw5LMQaU1sj82Dy8ZEe2BRXQS1cs'

async function transferTokens (bridge, account) {
  const tx = await bridge.connect(account).transferTokens(MOCK_TOKEN_ADDRESS, '250000000000000', koinosAddr1)
  await tx.wait()
  console.log('transferTokens done')

  setTimeout(async () => await transferTokens(bridge, account), 5000)
}

async function main () {
  const accounts = await ethers.getSigners()

  const Bridge = await ethers.getContractFactory('Bridge')
  const bridge = Bridge.attach(BRIDGE_ADDRESS)

  transferTokens(bridge, accounts[5])
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  // .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
