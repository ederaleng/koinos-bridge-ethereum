const { expect } = require('chai')
const { ethers } = require('hardhat')

const sigUtil = require('eth-sig-util')

const testValidators = [
  '0xc73280617F4daa107F8b2e0F4E75FA5b5239Cf24',
  '0x2b0e9EB31C3F3BC06437A7dF090a2f6a4D658150',
  '0x265d11e5bD1646C61F6dA0AdF3b404372268BDd3',
  '0x6283375C9f25903d31BC1C8a5f9a2C4d83a69F2C'
]

const testPrivateKeys = [
  '0x27fe82e9f20da97c4edfb3595b89e8acab93362e054aec78c3a6acec04e820dc',
  '0x5cd9472be623a9179f146cb76c477016ec7157a44b75eca291ac50c68f4dce06',
  '0xd30aafd5f7bf07df49f18e05410320882e5cad7c5e55e48500a582b7e7605bb3',
  '0x1016d0f886dc50b613c75207f188e9cc46aad1381f45bb92a45b0c889ad617e8'
]

const koinosAddr1 = '1GE2JqXw5LMQaU1sj82Dy8ZEe2BRXQS1cs'

const hashAndSign = async (...args) => {
  // eslint-disable-next-line no-undef
  const hash = await web3.utils.soliditySha3(...args)

  const signatures = []
  for (const i in testValidators) {
    const signature = await sigUtil.personalSign(ethers.utils.arrayify(testPrivateKeys[i]), {
      data: hash
    })
    signatures.push(signature)
  }

  return signatures
}

// eslint-disable-next-line no-undef
describe('Bridge', function () {
  let accounts
  let bridge
  let mockToken
  let mockWrappedToken
  let mockFeeToken
  let mockWETH

  async function init () {
    accounts = await ethers.getSigners()

    const WETH = await ethers.getContractFactory('MockWETH')
    mockWETH = await WETH.deploy()
    await mockWETH.deployed()

    const Bridge = await ethers.getContractFactory('Bridge')
    bridge = await Bridge.deploy(testValidators, mockWETH.address)
    await bridge.deployed()

    const WrappedToken = await ethers.getContractFactory('WrappedToken')
    mockWrappedToken = await WrappedToken.deploy()
    await mockWrappedToken.deployed()
    await mockWrappedToken.initialize('Koinos Mock Wrapped Token', 'KMWT', 18, bridge.address)

    const MockToken = await ethers.getContractFactory('MockToken')
    mockToken = await MockToken.deploy('10000000000000000000000000')
    await mockToken.deployed()

    const MockFeeToken = await ethers.getContractFactory('MockFeeToken')
    mockFeeToken = await MockFeeToken.deploy('10000000000000000000000000')
    await mockFeeToken.deployed()

    // transfer ERC20 token
    let tx = await mockToken.transfer(accounts[5].address, '1000000000000000000')
    await tx.wait()

    // increase allowance
    tx = await mockToken.connect(accounts[5]).increaseAllowance(bridge.address, '1000000000000000000')
    await tx.wait()
  }

  // eslint-disable-next-line no-undef
  it('should deploy bridge and add initial validators', async function () {
    await init()

    expect(await bridge.WETHAddress()).to.equal(mockWETH.address)

    const validatorsLength = await bridge.getValidatorsLength()
    for (let i = 0; i < validatorsLength; i++) {
      expect(await bridge.validators(i)).to.equal(testValidators[i])
    }
  })

  // eslint-disable-next-line no-undef
  it('should add support for ERC20 tokens', async function () {
    let nonce = await bridge.nonce()

    // add support for the mockToken
    let signatures = await hashAndSign(mockToken.address, nonce.toString(), bridge.address)

    let tx = await bridge.connect(accounts[10]).addSupportedToken(signatures, mockToken.address)
    await tx.wait()

    nonce = await bridge.nonce()

    // add support for the mockFeeToken
    signatures = await hashAndSign(mockFeeToken.address, nonce.toString(), bridge.address)

    tx = await bridge.connect(accounts[10]).addSupportedToken(signatures, mockFeeToken.address)
    await tx.wait()

    expect(await bridge.supportedTokens(0)).to.equal(mockToken.address)
    expect(await bridge.supportedTokens(1)).to.equal(mockFeeToken.address)
  })

  // eslint-disable-next-line no-undef
  it('should not add support for ERC20 tokens', async function () {
    const nonce = await bridge.nonce()

    // add support for the mockToken
    let signatures = await hashAndSign(mockToken.address, nonce.toString(), bridge.address)

    // quorum not met
    await expect(bridge.connect(accounts[10]).addSupportedToken(signatures.slice(2, 2), mockToken.address)).to.be.revertedWith('quorum not met')

    // invalid nonce which should turn into an "invalid signatures" error
    signatures = await hashAndSign(mockToken.address, '2', bridge.address)

    await expect(bridge.connect(accounts[10]).addSupportedToken(signatures, mockToken.address)).to.be.revertedWith('invalid signatures')
  })

  // eslint-disable-next-line no-undef
  it('should deposit ERC20 tokens', async function () {
    // lock the tokens
    let tx = await bridge.connect(accounts[5]).transferTokens(mockToken.address, '250000000000000000', koinosAddr1)
    await expect(tx).to.emit(bridge, 'LogTokensLocked').withArgs(mockToken.address, koinosAddr1, '25000000')

    expect(await mockToken.balanceOf(accounts[5].address)).to.equal('750000000000000000')
    expect(await mockToken.balanceOf(bridge.address)).to.equal('250000000000000000')

    // only lock normalized amounts (8 decimals max) and refund dust
    tx = await bridge.connect(accounts[5]).transferTokens(mockToken.address, '250000000000001234', koinosAddr1)
    await expect(tx).to.emit(bridge, 'LogTokensLocked').withArgs(mockToken.address, koinosAddr1, '25000000')

    expect(await mockToken.balanceOf(accounts[5].address)).to.equal('500000000000000000')
    expect(await mockToken.balanceOf(bridge.address)).to.equal('500000000000000000')
  })

  // eslint-disable-next-line no-undef
  it('should not deposit ERC20 tokens', async function () {
    await expect(bridge.connect(accounts[5]).transferTokens(accounts[10].address, '250000000000000000', koinosAddr1)).to.be.revertedWith('token is not supported')
    await expect(bridge.connect(accounts[5]).transferTokens(mockToken.address, '25000000', koinosAddr1)).to.be.revertedWith('normalizedAmount amount must be greater than 0')
  })

  // eslint-disable-next-line no-undef
  it('should withdraw ERC20 tokens', async function () {
    const koinosTxId = '0x12201c79b414123fcd8c9e536be7af4e765affffb7b5584c63024d6c20e77b0ee898'
    let koinosTxIdOp = 1

    let signatures = await hashAndSign(koinosTxId, koinosTxIdOp, mockToken.address, accounts[3].address, '10000000', bridge.address)

    expect(await mockToken.balanceOf(bridge.address)).to.equal('500000000000000000')
    // value is 8 decimals max
    let tx = await bridge.connect(accounts[10]).completeTransfer(koinosTxId, koinosTxIdOp, mockToken.address, accounts[3].address, '10000000', signatures)
    await tx.wait()

    expect(await mockToken.balanceOf(accounts[3].address)).to.equal('100000000000000000')
    expect(await mockToken.balanceOf(bridge.address)).to.equal('400000000000000000')

    koinosTxIdOp = 2

    signatures = await hashAndSign(koinosTxId, koinosTxIdOp, mockToken.address, accounts[3].address, '20000000', bridge.address)

    // value is 8 decimals max
    tx = await bridge.connect(accounts[10]).completeTransfer(koinosTxId, koinosTxIdOp, mockToken.address, accounts[3].address, '20000000', signatures)
    await tx.wait()

    expect(await mockToken.balanceOf(accounts[3].address)).to.equal('300000000000000000')
    expect(await mockToken.balanceOf(bridge.address)).to.equal('200000000000000000')
  })

  // eslint-disable-next-line no-undef
  it('should not withdraw ERC20 tokens', async function () {
    const koinosTxId = '0x12201c79b414123fcd8c9e536be7af4e765affffb7b5584c63024d6c20e77b0ee898'
    let koinosTxIdOp = 1

    let signatures = await hashAndSign(koinosTxId, koinosTxIdOp, mockToken.address, accounts[3].address, '10000000', bridge.address)

    await expect(bridge.connect(accounts[10]).completeTransfer(koinosTxId, koinosTxIdOp, accounts[3].address, accounts[3].address, '10000000', signatures)).to.be.revertedWith('token is not supported')
    await expect(bridge.connect(accounts[10]).completeTransfer(koinosTxId, koinosTxIdOp, mockToken.address, accounts[3].address, '10000000', signatures)).to.be.revertedWith('transfer already completed')

    koinosTxIdOp = 3

    signatures = await hashAndSign(koinosTxId, koinosTxIdOp, mockToken.address, accounts[3].address, '10000000', bridge.address)
    await expect(bridge.connect(accounts[10]).completeTransfer(koinosTxId, koinosTxIdOp, mockToken.address, accounts[3].address, '10000000', signatures.slice(0, 2))).to.be.revertedWith('quorum not met')
    await expect(bridge.connect(accounts[10]).completeTransfer(koinosTxId, koinosTxIdOp, mockToken.address, accounts[3].address, '20000000', signatures)).to.be.revertedWith('invalid signatures')
    await expect(bridge.connect(accounts[10]).completeTransfer(koinosTxId, 4, mockToken.address, accounts[3].address, '10000000', signatures)).to.be.revertedWith('invalid signatures')
    await expect(bridge.connect(accounts[10]).completeTransfer('0x12201c79b414123fcd8c9e536be7af4e765affffb7b5584c63024d6c20e77b0eE898', 4, mockToken.address, accounts[3].address, '10000000', signatures)).to.be.revertedWith('invalid signatures')
  })

  // eslint-disable-next-line no-undef
  it('should add support for Wrapped tokens', async function () {
    const nonce = await bridge.nonce()

    // add support for the mockWrappedToken
    const signatures = await hashAndSign(mockWrappedToken.address, nonce.toString(), bridge.address)

    const tx = await bridge.connect(accounts[10]).addSupportedWrappedToken(signatures, mockWrappedToken.address)
    await tx.wait()

    expect(await bridge.supportedWrappedTokens(0)).to.equal(mockWrappedToken.address)
  })

  // eslint-disable-next-line no-undef
  it('should not add support for Wrapped tokens', async function () {
    const nonce = await bridge.nonce()

    // add support for the mockWrappedToken
    let signatures = await hashAndSign(mockWrappedToken.address, nonce.toString(), bridge.address)

    // quorum not met
    await expect(bridge.connect(accounts[10]).addSupportedWrappedToken(signatures.slice(2, 2), mockWrappedToken.address)).to.be.revertedWith('quorum not met')

    // invalid nonce which should turn into an "invalid signatures" error
    signatures = await hashAndSign(mockWrappedToken.address, '2', bridge.address)

    await expect(bridge.connect(accounts[10]).addSupportedWrappedToken(signatures, mockWrappedToken.address)).to.be.revertedWith('invalid signatures')
  })

  // eslint-disable-next-line no-undef
  it('should deposit Wrapped tokens', async function () {
    const koinosTxId = '0x12201c79b414123fcd8c9e536be7af4e765affffb7b5584c63024d6c20e77b0ee899'
    let koinosTxIdOp = 1

    let signatures = await hashAndSign(koinosTxId, koinosTxIdOp, mockWrappedToken.address, accounts[4].address, '10000000', bridge.address)

    // value is 8 decimals max
    let tx = await bridge.connect(accounts[10]).completeTransfer(koinosTxId, koinosTxIdOp, mockWrappedToken.address, accounts[4].address, '10000000', signatures)
    await tx.wait()

    expect(await mockWrappedToken.balanceOf(accounts[4].address)).to.equal('10000000')
    expect(await mockWrappedToken.totalSupply()).to.equal('10000000')

    koinosTxIdOp = 2

    signatures = await hashAndSign(koinosTxId, koinosTxIdOp, mockWrappedToken.address, accounts[7].address, '200000000', bridge.address)

    // value is 8 decimals max
    tx = await bridge.connect(accounts[10]).completeTransfer(koinosTxId, koinosTxIdOp, mockWrappedToken.address, accounts[7].address, '200000000', signatures)
    await tx.wait()

    expect(await mockWrappedToken.balanceOf(accounts[7].address)).to.equal('200000000')
    expect(await mockWrappedToken.totalSupply()).to.equal('210000000')
  })

  // eslint-disable-next-line no-undef
  it('should not deposit Wrapped tokens', async function () {
    const koinosTxId = '0x12201c79b414123fcd8c9e536be7af4e765affffb7b5584c63024d6c20e77b0ee898'
    let koinosTxIdOp = 3

    let signatures = await hashAndSign(koinosTxId, koinosTxIdOp, mockWrappedToken.address, accounts[3].address, '10000000', bridge.address)

    await expect(bridge.connect(accounts[10]).completeTransfer(koinosTxId, koinosTxIdOp, accounts[3].address, accounts[3].address, '10000000', signatures)).to.be.revertedWith('token is not supported')
    await expect(bridge.connect(accounts[10]).completeTransfer(koinosTxId, koinosTxIdOp, mockWrappedToken.address, accounts[3].address, '10000000', signatures)).to.be.revertedWith('transfer already completed')

    koinosTxIdOp = 4

    signatures = await hashAndSign(koinosTxId, koinosTxIdOp, mockWrappedToken.address, accounts[3].address, '10000000', bridge.address)
    await expect(bridge.connect(accounts[10]).completeTransfer(koinosTxId, koinosTxIdOp, mockWrappedToken.address, accounts[3].address, '10000000', signatures.slice(0, 2))).to.be.revertedWith('quorum not met')
    await expect(bridge.connect(accounts[10]).completeTransfer(koinosTxId, koinosTxIdOp, mockWrappedToken.address, accounts[3].address, '20000000', signatures)).to.be.revertedWith('invalid signatures')
    await expect(bridge.connect(accounts[10]).completeTransfer(koinosTxId, 4, mockWrappedToken.address, accounts[3].address, '10000000', signatures)).to.be.revertedWith('invalid signatures')
    await expect(bridge.connect(accounts[10]).completeTransfer('0x12201c79b414123fcd8c9e536be7af4e765affffb7b5584c63024d6c20e77b0eE898', 4, mockWrappedToken.address, accounts[3].address, '10000000', signatures)).to.be.revertedWith('invalid signatures')
  })
})
