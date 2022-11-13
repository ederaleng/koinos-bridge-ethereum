// npx hardhat run --network localhost scripts/deploy.js
const hre = require('hardhat')
require('dotenv').config()

const { VALIDATORS_ADDR, WETH_ADDR } = process.env

const validators = VALIDATORS_ADDR.split('|')

async function main () {
  const Bridge = await hre.ethers.getContractFactory('Bridge')
  const bridge = await Bridge.deploy(validators, WETH_ADDR)

  await bridge.deployed()

  console.log('Bridge deployed to:', bridge.address)
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
