// npx hardhat run --network localhost scripts/deploy.js
const hre = require('hardhat')

const validators = [
  '0xCF308c08C640d96361539e0ee6a9f52becf74E10',
  '0xf993dd06b7D037F46B9Eafe8cC1Cb8DdD1430a85',
  '0x61F5ebA30a319818c4BF3D48B3Ee1DdA78De710B'
]

async function main () {
  const Bridge = await hre.ethers.getContractFactory('Bridge')
  const bridge = await Bridge.deploy(validators, '0xeD43f81C17976372Fcb5786Dd214572e7dbB92c7')

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
