// npx hardhat run --network localhost scripts/deploy.js
const { ethers } = require('hardhat')

const BRIDGE_ADDRESS = '0x5FbDB2315678afecb367f032d93F642f64180aa3'

async function main () {
  const [account] = await ethers.getSigners()

  const Bridge = await ethers.getContractFactory('Bridge')
  const bridge = Bridge.attach(BRIDGE_ADDRESS)

  const koinosTxId = '0x1220796bb5a9436ef8d1ff79ac2c555b3c3de7f01309f9f24b3e0efa1d00055830f3'
  const koinosTxIdOp = '1'
  const tokenAddress = '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512'
  const recipient = '0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65'
  const amount = '2500'
  const expiration = '1668211540278'
  const signatures = [
    '0x152304b134c90b5dfddb5ecd216c819d6a2e9af4b989893d7c9e3649b8c8bd4125f682c15e1c06f6d5d384b1fe82226e0a2f6135f3d88054bd45f86ec027f8451c',
    '0x4834932c9f8c733393ad55f041d7f022d2cf195e703264ad8f7f606c508923ae6e5617f36d56163bfd78b686ccdee53b0ec41424d9a7a256e48f3dc21c0257771b',
    '0xa19d9b71a4a11e8fbcf47625cb1506bcd72423c656a4ff000d5d9d4feb5f1d4818f5c00709dd9dc9327303ad03bbdf79d9c1d805292b467d0c5e310484d9ee611c'
  ]
  const tx = await bridge.connect(account).completeTransfer(koinosTxId, koinosTxIdOp, tokenAddress, recipient, amount, signatures, expiration)
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
