// npx hardhat run --network localhost scripts/deploy.js
const { ethers } = require('hardhat')
require('dotenv').config()

const { BRIDGE_ADDR } = process.env

async function main () {
  const [account] = await ethers.getSigners()

  const Bridge = await ethers.getContractFactory('Bridge')
  const bridge = Bridge.attach(BRIDGE_ADDR)

  const koinosTxId = '0x122042620de9aee17c93512c0acc98e3248cb88524998df5f95eaad65bf3ddbe9070'
  const koinosTxIdOp = '3'
  const tokenAddress = '0xeA756978B2D8754b0f92CAc325880aa13AF38f88'
  const recipient = '0x3D7D98070a3B5762fF4ed30Afc58F8f0000bE3b3'
  const amount = '1'
  const expiration = '1668465758850'
  const signatures = [
    '0xf41d6cdb452acb2f2dcae6d7bdf1a5ef679803f512505ccea3cc7ee313899337119c3ae79b77c77c2a44b6e8fe4ea8d6ced981d4f37c7c90cef9c0a118b641fe1c',
    '0x0164014af2a99d7763499403a4bed631bfab42fa95725ab150cfb86e974f997238a8e30c2ffd10c768b6b82032745a0c549188d6ba3d8b731fce06af17ab404a1b',
    '0x0d81c709a7cc7057cc4f19c6f8836b3ea1d775cfac8b622edcc6628abcce05ff07e6722bb2db337211b29f201d0829d52d2dfab1366331853d5a4c6506736bd71b'
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
