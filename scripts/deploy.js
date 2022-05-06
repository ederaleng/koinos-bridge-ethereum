// npx hardhat run --network localhost scripts/deploy.js
const hre = require('hardhat')

const validators = [
  '0xc73280617F4daa107F8b2e0F4E75FA5b5239Cf24',
  '0x2b0e9EB31C3F3BC06437A7dF090a2f6a4D658150',
  '0x265d11e5bD1646C61F6dA0AdF3b404372268BDd3',
  '0x6283375C9f25903d31BC1C8a5f9a2C4d83a69F2C'
]

async function main () {
  const Bridge = await hre.ethers.getContractFactory('Bridge')
  const bridge = await Bridge.deploy(validators, '0x0000000000000000000000000000000000000000')

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
