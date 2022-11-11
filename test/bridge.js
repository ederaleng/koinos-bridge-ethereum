const { expect } = require('chai')
const { ethers } = require('hardhat')
const { ActionId } = require('../scripts/util')

const sigUtil = require('eth-sig-util')

const nowPlus1Hr = Math.floor(new Date().getTime()) + 3600000
const nowMinus1Hr = Math.floor(new Date().getTime()) - 3600000

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

const addtlValidators = [
  '0x6AAbb38d69B112Bd4Ed9c319206Ed3CA71f89eCB',
  '0x2599f0F9eD95dFfbcE222eA32466cf0C0835E09A'
]

const addtlValidatorsPrivateKeys = [
  '0xd2b100ba453e40218f8dda0e79bcf96aed6207bd952a62b94f7977fdf15c490b',
  '0x73ad31769582c89e13c8b29a28d9a526a640c96e022000221150902cc8245b6c'
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

const getLastBlockTimestamp = async () => {
  const blockNumBefore = await ethers.provider.getBlockNumber()
  const blockBefore = await ethers.provider.getBlock(blockNumBefore)
  return blockBefore.timestamp * 1000
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
    let signatures = await hashAndSign(ActionId.AddSupportedToken, mockToken.address, nonce.toString(), bridge.address, nowPlus1Hr)

    let tx = await bridge.connect(accounts[10]).addSupportedToken(signatures, mockToken.address, nowPlus1Hr)
    await tx.wait()

    nonce = await bridge.nonce()

    // add support for the mockFeeToken
    signatures = await hashAndSign(ActionId.AddSupportedToken, mockFeeToken.address, nonce.toString(), bridge.address, nowPlus1Hr)

    tx = await bridge.connect(accounts[10]).addSupportedToken(signatures, mockFeeToken.address, nowPlus1Hr)
    await tx.wait()

    expect(await bridge.supportedTokens(0)).to.equal(mockToken.address)
    expect(await bridge.supportedTokens(1)).to.equal(mockFeeToken.address)
  })

  // eslint-disable-next-line no-undef
  it('should not add support for ERC20 tokens', async function () {
    const nonce = await bridge.nonce()

    // add support for the mockToken
    let signatures = await hashAndSign(ActionId.AddSupportedWrappedToken, mockWrappedToken.address, nonce.toString(), bridge.address, nowPlus1Hr)

    // Token already exists
    await expect(bridge.connect(accounts[10]).addSupportedToken(signatures.slice(2, 2), mockToken.address, nowPlus1Hr)).to.be.revertedWith('Token already exists')

    // quorum not met
    await expect(bridge.connect(accounts[10]).addSupportedToken(signatures.slice(2, 2), mockWrappedToken.address, nowPlus1Hr)).to.be.revertedWith('quorum not met')

    // expired signatures
    await expect(bridge.connect(accounts[10]).addSupportedToken(signatures.slice(2, 2), mockWrappedToken.address, nowMinus1Hr)).to.be.revertedWith('expired signatures')

    // invalid nonce which should turn into an "invalid signatures" error
    signatures = await hashAndSign(ActionId.AddSupportedWrappedToken, mockWrappedToken.address, '2', bridge.address, nowPlus1Hr)

    await expect(bridge.connect(accounts[10]).addSupportedToken(signatures, mockWrappedToken.address, nowPlus1Hr)).to.be.revertedWith('invalid signatures')
  })

  // eslint-disable-next-line no-undef
  it('should deposit ERC20 tokens', async function () {
    // lock the tokens
    let tx = await bridge.connect(accounts[5]).transferTokens(mockToken.address, '250000000000000000', koinosAddr1)
    await expect(tx).to.emit(bridge, 'TokensLockedEvent').withArgs(accounts[5].address, mockToken.address, '25000000', koinosAddr1, await getLastBlockTimestamp())

    expect(await mockToken.balanceOf(accounts[5].address)).to.equal('750000000000000000')
    expect(await mockToken.balanceOf(bridge.address)).to.equal('250000000000000000')

    // only lock normalized amounts (8 decimals max) and refund dust
    tx = await bridge.connect(accounts[5]).transferTokens(mockToken.address, '250000000000001234', koinosAddr1)
    await expect(tx).to.emit(bridge, 'TokensLockedEvent').withArgs(accounts[5].address, mockToken.address, '25000000', koinosAddr1, await getLastBlockTimestamp())

    expect(await mockToken.balanceOf(accounts[5].address)).to.equal('500000000000000000')
    expect(await mockToken.balanceOf(bridge.address)).to.equal('500000000000000000')
  })

  // eslint-disable-next-line no-undef
  it('should not deposit ERC20 tokens', async function () {
    await expect(bridge.connect(accounts[5]).transferTokens(accounts[10].address, '250000000000000000', koinosAddr1)).to.be.revertedWith('token is not supported')
    await expect(bridge.connect(accounts[5]).transferTokens(mockToken.address, '25000000', koinosAddr1)).to.be.revertedWith('normalizedAmount amount must be greater than 0')
  })

  // eslint-disable-next-line no-undef
  it('should transfer ERC20 tokens', async function () {
    const koinosTxId = '0x12201c79b414123fcd8c9e536be7af4e765affffb7b5584c63024d6c20e77b0ee898'
    let koinosTxIdOp = 1

    let signatures = await hashAndSign(ActionId.CompleteTransfer, koinosTxId, koinosTxIdOp, mockToken.address, accounts[3].address, '10000000', bridge.address, nowPlus1Hr)

    expect(await mockToken.balanceOf(bridge.address)).to.equal('500000000000000000')
    // value is 8 decimals max
    let tx = await bridge.connect(accounts[10]).completeTransfer(koinosTxId, koinosTxIdOp, mockToken.address, accounts[3].address, '10000000', signatures, nowPlus1Hr)
    await tx.wait()

    await expect(tx).to.emit(bridge, 'TransferCompletedEvent').withArgs(koinosTxId, koinosTxIdOp)
    expect(await mockToken.balanceOf(accounts[3].address)).to.equal('100000000000000000')
    expect(await mockToken.balanceOf(bridge.address)).to.equal('400000000000000000')

    koinosTxIdOp = 2

    signatures = await hashAndSign(ActionId.CompleteTransfer, koinosTxId, koinosTxIdOp, mockToken.address, accounts[3].address, '20000000', bridge.address, nowPlus1Hr)

    // value is 8 decimals max
    tx = await bridge.connect(accounts[10]).completeTransfer(koinosTxId, koinosTxIdOp, mockToken.address, accounts[3].address, '20000000', signatures, nowPlus1Hr)
    await tx.wait()
    await expect(tx).to.emit(bridge, 'TransferCompletedEvent').withArgs(koinosTxId, koinosTxIdOp)

    expect(await mockToken.balanceOf(accounts[3].address)).to.equal('300000000000000000')
    expect(await mockToken.balanceOf(bridge.address)).to.equal('200000000000000000')
  })

  // eslint-disable-next-line no-undef
  it('should not transfer ERC20 tokens', async function () {
    const koinosTxId = '0x12201c79b414123fcd8c9e536be7af4e765affffb7b5584c63024d6c20e77b0ee898'
    let koinosTxIdOp = 1

    let signatures = await hashAndSign(ActionId.CompleteTransfer, koinosTxId, koinosTxIdOp, mockToken.address, accounts[3].address, '10000000', bridge.address, nowPlus1Hr)

    await expect(bridge.connect(accounts[10]).completeTransfer(koinosTxId, koinosTxIdOp, accounts[3].address, accounts[3].address, '10000000', signatures, nowPlus1Hr)).to.be.revertedWith('token is not supported')
    await expect(bridge.connect(accounts[10]).completeTransfer(koinosTxId, koinosTxIdOp, mockToken.address, accounts[3].address, '10000000', signatures, nowPlus1Hr)).to.be.revertedWith('transfer already completed')

    koinosTxIdOp = 3

    signatures = await hashAndSign(ActionId.CompleteTransfer, koinosTxId, koinosTxIdOp, mockToken.address, accounts[3].address, '10000000', bridge.address, nowPlus1Hr)
    await expect(bridge.connect(accounts[10]).completeTransfer(koinosTxId, koinosTxIdOp, mockToken.address, accounts[3].address, '10000000', signatures.slice(0, 2), nowPlus1Hr)).to.be.revertedWith('quorum not met')
    await expect(bridge.connect(accounts[10]).completeTransfer(koinosTxId, koinosTxIdOp, mockToken.address, accounts[3].address, '20000000', signatures, nowPlus1Hr)).to.be.revertedWith('invalid signatures')
    await expect(bridge.connect(accounts[10]).completeTransfer(koinosTxId, 4, mockToken.address, accounts[3].address, '10000000', signatures, nowPlus1Hr)).to.be.revertedWith('invalid signatures')
    await expect(bridge.connect(accounts[10]).completeTransfer('0x12201c79b414123fcd8c9e536be7af4e765affffb7b5584c63024d6c20e77b0eE898', 4, mockToken.address, accounts[3].address, '10000000', signatures, nowPlus1Hr)).to.be.revertedWith('invalid signatures')

    signatures = await hashAndSign(ActionId.CompleteTransfer, koinosTxId, koinosTxIdOp, mockToken.address, accounts[3].address, '10000000', bridge.address, nowMinus1Hr)
    await expect(bridge.connect(accounts[10]).completeTransfer(koinosTxId, koinosTxIdOp, mockToken.address, accounts[3].address, '10000000', signatures, nowMinus1Hr)).to.be.revertedWith('expired signatures')
  })

  // eslint-disable-next-line no-undef
  it('should add support for Wrapped tokens', async function () {
    const nonce = await bridge.nonce()

    // add support for the mockWrappedToken
    const signatures = await hashAndSign(ActionId.AddSupportedWrappedToken, mockWrappedToken.address, nonce.toString(), bridge.address, nowPlus1Hr)

    const tx = await bridge.connect(accounts[10]).addSupportedWrappedToken(signatures, mockWrappedToken.address, nowPlus1Hr)
    await tx.wait()

    expect(await bridge.supportedWrappedTokens(0)).to.equal(mockWrappedToken.address)
  })

  // eslint-disable-next-line no-undef
  it('should not add support for Wrapped tokens', async function () {
    const nonce = await bridge.nonce()

    // add support for the mockWrappedToken
    let signatures = await hashAndSign(ActionId.AddSupportedWrappedToken, mockWrappedToken.address, nonce.toString(), bridge.address, nowPlus1Hr)

    // Token already exists
    await expect(bridge.connect(accounts[10]).addSupportedWrappedToken(signatures.slice(2, 2), mockWrappedToken.address, nowPlus1Hr)).to.be.revertedWith('Token already exists')

    // quorum not met
    await expect(bridge.connect(accounts[10]).addSupportedWrappedToken(signatures.slice(2, 2), mockToken.address, nowPlus1Hr)).to.be.revertedWith('quorum not met')

    // expired signatures
    await expect(bridge.connect(accounts[10]).addSupportedWrappedToken(signatures.slice(2, 2), mockToken.address, nowMinus1Hr)).to.be.revertedWith('expired signatures')

    // invalid nonce which should turn into an "invalid signatures" error
    signatures = await hashAndSign(ActionId.AddSupportedWrappedToken, mockToken.address, '2', bridge.address)

    await expect(bridge.connect(accounts[10]).addSupportedWrappedToken(signatures, mockToken.address, nowPlus1Hr)).to.be.revertedWith('invalid signatures')
  })

  // eslint-disable-next-line no-undef
  it('should mint Wrapped tokens', async function () {
    const koinosTxId = '0x12201c79b414123fcd8c9e536be7af4e765affffb7b5584c63024d6c20e77b0ee899'
    let koinosTxIdOp = 1

    let signatures = await hashAndSign(ActionId.CompleteTransfer, koinosTxId, koinosTxIdOp, mockWrappedToken.address, accounts[4].address, '10000000', bridge.address, nowPlus1Hr)

    // value is 8 decimals max
    let tx = await bridge.connect(accounts[10]).completeTransfer(koinosTxId, koinosTxIdOp, mockWrappedToken.address, accounts[4].address, '10000000', signatures, nowPlus1Hr)
    await tx.wait()

    expect(await mockWrappedToken.balanceOf(accounts[4].address)).to.equal('10000000')
    expect(await mockWrappedToken.totalSupply()).to.equal('10000000')

    koinosTxIdOp = 2

    signatures = await hashAndSign(ActionId.CompleteTransfer, koinosTxId, koinosTxIdOp, mockWrappedToken.address, accounts[7].address, '200000000', bridge.address, nowPlus1Hr)

    // value is 8 decimals max
    tx = await bridge.connect(accounts[10]).completeTransfer(koinosTxId, koinosTxIdOp, mockWrappedToken.address, accounts[7].address, '200000000', signatures, nowPlus1Hr)
    await tx.wait()

    expect(await mockWrappedToken.balanceOf(accounts[7].address)).to.equal('200000000')
    expect(await mockWrappedToken.totalSupply()).to.equal('210000000')
  })

  // eslint-disable-next-line no-undef
  it('should not mint Wrapped tokens', async function () {
    const koinosTxId = '0x12201c79b414123fcd8c9e536be7af4e765affffb7b5584c63024d6c20e77b0ee899'
    let koinosTxIdOp = 2

    let signatures = await hashAndSign(ActionId.CompleteTransfer, koinosTxId, koinosTxIdOp, mockWrappedToken.address, accounts[7].address, '200000000', bridge.address, nowPlus1Hr)

    await expect(bridge.connect(accounts[10]).completeTransfer(koinosTxId, koinosTxIdOp, accounts[3].address, accounts[3].address, '200000000', signatures, nowPlus1Hr)).to.be.revertedWith('token is not supported')
    await expect(bridge.connect(accounts[10]).completeTransfer(koinosTxId, koinosTxIdOp, mockWrappedToken.address, accounts[7].address, '200000000', signatures, nowPlus1Hr)).to.be.revertedWith('transfer already completed')

    koinosTxIdOp = 3

    signatures = await hashAndSign(ActionId.CompleteTransfer, koinosTxId, koinosTxIdOp, mockWrappedToken.address, accounts[3].address, '10000000', bridge.address, nowPlus1Hr)
    await expect(bridge.connect(accounts[10]).completeTransfer(koinosTxId, koinosTxIdOp, mockWrappedToken.address, accounts[3].address, '10000000', signatures.slice(0, 2), nowPlus1Hr)).to.be.revertedWith('quorum not met')
    await expect(bridge.connect(accounts[10]).completeTransfer(koinosTxId, koinosTxIdOp, mockWrappedToken.address, accounts[3].address, '20000000', signatures, nowPlus1Hr)).to.be.revertedWith('invalid signatures')
    await expect(bridge.connect(accounts[10]).completeTransfer(koinosTxId, 4, mockWrappedToken.address, accounts[3].address, '10000000', signatures, nowPlus1Hr)).to.be.revertedWith('invalid signatures')
    await expect(bridge.connect(accounts[10]).completeTransfer('0x12201c79b414123fcd8c9e536be7af4e765affffb7b5584c63024d6c20e77b0eE898', 4, mockWrappedToken.address, accounts[3].address, '10000000', signatures, nowPlus1Hr)).to.be.revertedWith('invalid signatures')
    await expect(bridge.connect(accounts[10]).completeTransfer('0x12201c79b414123fcd8c9e536be7af4e765affffb7b5584c63024d6c20e77b0eE898', 4, mockWrappedToken.address, accounts[3].address, '10000000', signatures, nowMinus1Hr)).to.be.revertedWith('expired signatures')
  })

  // eslint-disable-next-line no-undef
  it('should remove support for ERC20 tokens', async function () {
    let nonce = await bridge.nonce()

    // remove support for the mockToken
    let signatures = await hashAndSign(ActionId.RemoveSupportedToken, mockToken.address, nonce.toString(), bridge.address, nowPlus1Hr)

    let tx = await bridge.connect(accounts[10]).removeSupportedToken(signatures, mockToken.address, nowPlus1Hr)
    await tx.wait()

    nonce = await bridge.nonce()

    // remove support for the mockFeeToken
    signatures = await hashAndSign(ActionId.RemoveSupportedToken, mockFeeToken.address, nonce.toString(), bridge.address, nowPlus1Hr)

    tx = await bridge.connect(accounts[10]).removeSupportedToken(signatures, mockFeeToken.address, nowPlus1Hr)
    await tx.wait()

    expect(await bridge.getSupportedTokensLength()).to.equal(0)

    const koinosTxId = '0x12201c79b414123fcd8c9e536be7af4e765affffb7b5584c63024d6c20e77b0ee899'
    const koinosTxIdOp = 20

    signatures = await hashAndSign(ActionId.CompleteTransfer, koinosTxId, koinosTxIdOp, mockToken.address, accounts[7].address, '200000000', bridge.address, nowPlus1Hr)
    await expect(bridge.connect(accounts[10]).completeTransfer(koinosTxId, koinosTxIdOp, mockToken.address, accounts[7].address, '200000000', signatures, nowPlus1Hr)).to.be.revertedWith('token is not supported')

    signatures = await hashAndSign(ActionId.CompleteTransfer, koinosTxId, koinosTxIdOp, mockFeeToken.address, accounts[7].address, '200000000', bridge.address, nowPlus1Hr)
    await expect(bridge.connect(accounts[10]).completeTransfer(koinosTxId, koinosTxIdOp, mockFeeToken.address, accounts[7].address, '200000000', signatures, nowPlus1Hr)).to.be.revertedWith('token is not supported')
    await expect(bridge.connect(accounts[10]).completeTransfer(koinosTxId, koinosTxIdOp, mockFeeToken.address, accounts[7].address, '200000000', signatures, nowMinus1Hr)).to.be.revertedWith('expired signatures')
  })

  // eslint-disable-next-line no-undef
  it('should remove support for Wrapped tokens', async function () {
    const nonce = await bridge.nonce()

    // add support for the mockWrappedToken
    let signatures = await hashAndSign(ActionId.RemoveSupportedWrappedToken, mockWrappedToken.address, nonce.toString(), bridge.address, nowPlus1Hr)

    const tx = await bridge.connect(accounts[10]).removeSupportedWrappedToken(signatures, mockWrappedToken.address, nowPlus1Hr)
    await tx.wait()

    expect(await bridge.getSupportedWrappedTokensLength()).to.equal(0)

    const koinosTxId = '0x12201c79b414123fcd8c9e536be7af4e765affffb7b5584c63024d6c20e77b0ee899'
    const koinosTxIdOp = 20

    signatures = await hashAndSign(ActionId.CompleteTransfer, koinosTxId, koinosTxIdOp, mockWrappedToken.address, accounts[7].address, '200000000', bridge.address, nowPlus1Hr)

    await expect(bridge.connect(accounts[10]).completeTransfer(koinosTxId, koinosTxIdOp, mockWrappedToken.address, accounts[7].address, '200000000', signatures, nowPlus1Hr)).to.be.revertedWith('token is not supported')
    await expect(bridge.connect(accounts[10]).completeTransfer(koinosTxId, koinosTxIdOp, mockWrappedToken.address, accounts[7].address, '200000000', signatures, nowMinus1Hr)).to.be.revertedWith('expired signatures')
  })

  // eslint-disable-next-line no-undef
  it('should pause the bridge', async function () {
    const nonce = await bridge.nonce()

    let signatures = await hashAndSign(ActionId.SetPause, true, nonce.toString(), bridge.address, nowPlus1Hr)

    const tx = await bridge.connect(accounts[10]).pause(signatures, nowPlus1Hr)
    await tx.wait()

    const koinosTxId = '0x12201c79b414123fcd8c9e536be7af4e765affffb7b5584c63024d6c20e77b0ee899'
    const koinosTxIdOp = 20

    signatures = await hashAndSign(ActionId.CompleteTransfer, koinosTxId, koinosTxIdOp, mockWrappedToken.address, accounts[7].address, '200000000', bridge.address, nowPlus1Hr)

    await expect(bridge.connect(accounts[10]).completeTransfer(koinosTxId, koinosTxIdOp, mockWrappedToken.address, accounts[7].address, '200000000', signatures, nowPlus1Hr)).to.be.revertedWith('Bridge is paused')
    await expect(bridge.connect(accounts[5]).transferTokens(accounts[10].address, '250000000000000000', koinosAddr1)).to.be.revertedWith('Bridge is paused')
  })

  // eslint-disable-next-line no-undef
  it('should unpause the bridge', async function () {
    const nonce = await bridge.nonce()

    let signatures = await hashAndSign(ActionId.SetPause, false, nonce.toString(), bridge.address, nowPlus1Hr)

    const tx = await bridge.connect(accounts[10]).unpause(signatures, nowPlus1Hr)
    await tx.wait()

    const koinosTxId = '0x12201c79b414123fcd8c9e536be7af4e765affffb7b5584c63024d6c20e77b0ee899'
    const koinosTxIdOp = 20

    signatures = await hashAndSign(ActionId.CompleteTransfer, koinosTxId, koinosTxIdOp, mockWrappedToken.address, accounts[7].address, '200000000', bridge.address, nowPlus1Hr)

    await expect(bridge.connect(accounts[10]).completeTransfer(koinosTxId, koinosTxIdOp, mockWrappedToken.address, accounts[7].address, '200000000', signatures, nowPlus1Hr)).to.be.revertedWith('token is not supported')
    await expect(bridge.connect(accounts[5]).transferTokens(accounts[10].address, '250000000000000000', koinosAddr1)).to.be.revertedWith('token is not supported')
  })

  // eslint-disable-next-line no-undef
  it('should add validators', async function () {
    const initialValidatorsLength = await bridge.getValidatorsLength()

    let nonce = await bridge.nonce()

    // add support for the mockWrappedToken
    let signatures = await hashAndSign(ActionId.AddValidator, addtlValidators[0], nonce.toString(), bridge.address, nowPlus1Hr)

    let tx = await bridge.connect(accounts[10]).addValidator(signatures, addtlValidators[0], nowPlus1Hr)
    await tx.wait()

    let newValidatorsLength = await bridge.getValidatorsLength()
    expect(newValidatorsLength).to.equal(parseInt(initialValidatorsLength) + 1)
    expect(await bridge.validators(newValidatorsLength - 1)).to.equal(addtlValidators[0])

    nonce = await bridge.nonce()
    signatures = await hashAndSign(ActionId.AddValidator, addtlValidators[1], nonce.toString(), bridge.address, nowPlus1Hr)

    tx = await bridge.connect(accounts[10]).addValidator(signatures, addtlValidators[1], nowPlus1Hr)
    await tx.wait()

    newValidatorsLength = await bridge.getValidatorsLength()
    expect(newValidatorsLength).to.equal(parseInt(initialValidatorsLength) + 2)
    expect(await bridge.validators(newValidatorsLength - 1)).to.equal(addtlValidators[1])
  })

  // eslint-disable-next-line no-undef
  it('should remove validators', async function () {
    const initialValidatorsLength = await bridge.getValidatorsLength()

    let nonce = await bridge.nonce()

    let signatures = await hashAndSign(ActionId.RemoveValidator, addtlValidators[0], nonce.toString(), bridge.address, nowPlus1Hr)

    // eslint-disable-next-line no-undef
    const hash = await web3.utils.soliditySha3(ActionId.RemoveValidator, addtlValidators[0], nonce.toString(), bridge.address, nowPlus1Hr)

    const signature = await sigUtil.personalSign(ethers.utils.arrayify(addtlValidatorsPrivateKeys[1]), {
      data: hash
    })
    signatures.push(signature)

    let tx = await bridge.connect(accounts[10]).removeValidator(signatures, addtlValidators[0], nowPlus1Hr)
    await tx.wait()

    let newValidatorsLength = await bridge.getValidatorsLength()
    expect(newValidatorsLength).to.equal(parseInt(initialValidatorsLength) - 1)
    expect(await bridge.validators(newValidatorsLength - 1)).to.equal(addtlValidators[1])

    nonce = await bridge.nonce()
    signatures = await hashAndSign(ActionId.RemoveValidator, '0xc73280617F4daa107F8b2e0F4E75FA5b5239Cf24', nonce.toString(), bridge.address, nowPlus1Hr)

    tx = await bridge.connect(accounts[10]).removeValidator(signatures, '0xc73280617F4daa107F8b2e0F4E75FA5b5239Cf24', nowPlus1Hr)
    await tx.wait()

    newValidatorsLength = await bridge.getValidatorsLength()
    expect(newValidatorsLength).to.equal(parseInt(initialValidatorsLength) - 2)
    expect(await bridge.validators(0)).to.equal('0x2b0e9EB31C3F3BC06437A7dF090a2f6a4D658150')
  })
})
