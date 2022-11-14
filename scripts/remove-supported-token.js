// npx hardhat run --network localhost scripts/deploy.js
const hre = require('hardhat')
const sigUtil = require('eth-sig-util')
require('dotenv').config()
const { ActionId } = require('./util')

const TOKEN_ADDR = '0xeA756978B2D8754b0f92CAc325880aa13AF38f88'

const nowPlus1Hr = Math.floor(new Date().getTime()) + 3600000

const { BRIDGE_ADDR, VALIDATORS_PK } = process.env

const privateKeys = VALIDATORS_PK.split('|')

const hashAndSign = async (...args) => {
  // eslint-disable-next-line no-undef
  const hash = await web3.utils.soliditySha3(...args)

  const signatures = []
  for (const i in privateKeys) {
    const signature = await sigUtil.personalSign(hre.ethers.utils.arrayify(privateKeys[i]), {
      data: hash
    })
    signatures.push(signature)
  }

  return signatures
}

async function main () {
  const [deployer] = await hre.ethers.getSigners()

  const bridge = await hre.ethers.getContractFactory('Bridge')
  const bridgeContract = bridge.attach(BRIDGE_ADDR)

  const nonce = await bridgeContract.nonce()

  const signatures = await hashAndSign(ActionId.RemoveSupportedToken, TOKEN_ADDR, nonce.toString(), bridgeContract.address, nowPlus1Hr)

  console.log('signatures', signatures)

  const tx = await bridgeContract.connect(deployer).removeSupportedToken(signatures, TOKEN_ADDR, nowPlus1Hr)
  await tx.wait()

  console.log('Token support removed', TOKEN_ADDR)
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
