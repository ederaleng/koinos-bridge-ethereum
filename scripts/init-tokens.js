// npx hardhat run --network localhost scripts/deploy.js
const { ethers } = require('hardhat')
const sigUtil = require('eth-sig-util')
const { ActionId } = require('./util')

const nowPlus1Hr = Math.floor(new Date().getTime() / 1000) + 3600

const validators = [
  '0xc73280617F4daa107F8b2e0F4E75FA5b5239Cf24',
  '0x2b0e9EB31C3F3BC06437A7dF090a2f6a4D658150',
  '0x265d11e5bD1646C61F6dA0AdF3b404372268BDd3'
]

const privateKeys = [
  '0x27fe82e9f20da97c4edfb3595b89e8acab93362e054aec78c3a6acec04e820dc',
  '0x5cd9472be623a9179f146cb76c477016ec7157a44b75eca291ac50c68f4dce06',
  '0xd30aafd5f7bf07df49f18e05410320882e5cad7c5e55e48500a582b7e7605bb3'
]

const BRIDGE_ADDRESS = '0x5FbDB2315678afecb367f032d93F642f64180aa3'

const hashAndSign = async (...args) => {
  // eslint-disable-next-line no-undef
  const hash = await web3.utils.soliditySha3(...args)

  const signatures = []
  for (const i in validators) {
    const signature = await sigUtil.personalSign(ethers.utils.arrayify(privateKeys[i]), {
      data: hash
    })
    signatures.push(signature)
  }

  return signatures
}

async function main () {
  const accounts = await ethers.getSigners()

  const Bridge = await ethers.getContractFactory('Bridge')
  const bridge = await Bridge.deploy(validators, '0x0000000000000000000000000000000000000000')

  await bridge.deployed()

  console.log('Bridge deployed to:', bridge.address)

  const MockToken = await ethers.getContractFactory('MockToken')
  const mockToken = await MockToken.deploy('10000000000000000000000000')
  await mockToken.deployed()

  console.log('MockToken deployed to:', mockToken.address)

  // transfer ERC20 token
  let tx = await mockToken.transfer(accounts[5].address, '1000000000000000000')
  await tx.wait()

  console.log('MockToken transfered to:', accounts[5].address)

  // increase allowance
  tx = await mockToken.connect(accounts[5]).increaseAllowance(BRIDGE_ADDRESS, '1000000000000000000')
  await tx.wait()

  console.log('allowance increased:', accounts[5].address, BRIDGE_ADDRESS)

  const nonce = await bridge.nonce()

  console.log('nonce:', nonce)

  // add support for the mockToken
  const signatures = await hashAndSign(ActionId.AddSupportedToken, mockToken.address, nonce.toString(), bridge.address, nowPlus1Hr)

  tx = await bridge.connect(accounts[10]).addSupportedToken(signatures, mockToken.address, nowPlus1Hr)
  await tx.wait()

  console.log('addSupportedToken:', mockToken.address)

  // for (let index = 0; index < 10; index++) {
  //   tx = await bridge.connect(accounts[5]).transferTokens(mockToken.address, '250000000000000', koinosAddr1)
  //   await tx.wait()
  //   console.log('transferTokens done', index)
  // }
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
