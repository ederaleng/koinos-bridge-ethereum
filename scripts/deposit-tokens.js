// npx hardhat run --network localhost scripts/deploy.js
const { ethers } = require('hardhat')

const { BRIDGE_ADDR } = process.env
const RECIPIENT = '1Bf5W4LZ2FTmzPcA6d8QeLgAYmCKdZp2nN'

async function transferTokens (bridge, account) {
  const tx = await bridge.connect(account).wrapAndTransferETH(RECIPIENT, {
    value: ethers.utils.parseEther('0.00000001')
  })
  await tx.wait()
  console.log('transferTokens done', tx.hash)
}

async function main () {
  const [deployer] = await ethers.getSigners()

  const Bridge = await ethers.getContractFactory('Bridge')
  const bridgeContract = Bridge.attach(BRIDGE_ADDR)

  transferTokens(bridgeContract, deployer)
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  // .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
