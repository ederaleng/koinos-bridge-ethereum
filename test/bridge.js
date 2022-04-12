const { expect } = require("chai");
const { ethers } = require("hardhat");

const sigUtil = require("eth-sig-util")

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

const koinosAddr1 = "1GE2JqXw5LMQaU1sj82Dy8ZEe2BRXQS1cs";

describe("Bridge", function () {
  let accounts;
  let bridge;
  let mockToken;
  let mockTokenOwner;

  let mockWrappedToken;
  let mockWrappedTokenOwner;

  let mockFeeToken;
  let mockFeeTokenOwner;

  let mockWETH;

  async function init() {
    accounts = await ethers.getSigners();

    const WETH = await ethers.getContractFactory("MockWETH");
    mockWETH = await WETH.deploy();
    await mockWETH.deployed();

    const Bridge = await ethers.getContractFactory("Bridge");
    bridge = await Bridge.deploy(testValidators, mockWETH.address);
    await bridge.deployed();

    const WrappedToken = await ethers.getContractFactory("WrappedToken");
    mockWrappedToken = await WrappedToken.deploy();
    await mockWrappedToken.deployed();
    mockWrappedTokenOwner = accounts[0]
    await mockWrappedToken.initialize("Koinos Mock Wrapped Token", "KMWT", 18, mockWrappedTokenOwner.address);

    const MockToken = await ethers.getContractFactory("WrappedToken");
    mockToken = await MockToken.deploy();
    await mockToken.deployed();
    mockTokenOwner = accounts[1];
    const initMockToken = await mockToken.initialize("Mock ERC20 Token", "ERC20", 18, mockTokenOwner.address);

    // wait until the transaction is mined
    await initMockToken.wait();

    const MockFeeToken = await ethers.getContractFactory("WrappedToken");
    mockFeeToken = await MockFeeToken.deploy();
    await mockFeeToken.deployed();
    mockFeeTokenOwner = accounts[2];
    const initMockFeeToken = await mockFeeToken.initialize("Mock ERC20 Fee Token", "ERC20FEE", 18, mockFeeTokenOwner.address);

    // wait until the transaction is mined
    await initMockFeeToken.wait();
  }

  it("should deploy bridge and add initial validators", async function () {
    await init()

    expect(await bridge.WETHAddress()).to.equal(mockWETH.address);

    let validatorsLength = await bridge.getValidatorsLength()
    for (i = 0; i < validatorsLength; i++) {
      expect(await bridge.validators(i)).to.equal(testValidators[i]);
    }
  });

  it("should deposit ERC20 tokens", async function () {
    // mint ERC20 token
    let tx = await mockToken.connect(mockTokenOwner).mint(accounts[5].address, ethers.BigNumber.from("1000000000000000000"))
    await tx.wait();
    expect(await mockToken.balanceOf(accounts[5].address)).to.equal(ethers.BigNumber.from("1000000000000000000"));

    // increase allowance
    tx = await mockToken.connect(accounts[5]).increaseAllowance(bridge.address, ethers.BigNumber.from("1000000000000000000"))
    await tx.wait();

    // lock the tokens
    tx = await bridge.connect(accounts[5]).transferTokens(mockToken.address, ethers.BigNumber.from("250000000000000000"), koinosAddr1)
    await expect(tx).to.emit(bridge, 'LogTokensLocked').withArgs(mockToken.address, koinosAddr1, ethers.BigNumber.from("25000000"))
    
    expect(await mockToken.balanceOf(accounts[5].address)).to.equal(ethers.BigNumber.from("750000000000000000"));
    expect(await mockToken.balanceOf(bridge.address)).to.equal(ethers.BigNumber.from("250000000000000000"));
  });

});
