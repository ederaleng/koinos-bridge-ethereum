require('@nomiclabs/hardhat-waffle')
require('@nomiclabs/hardhat-web3')

require('dotenv').config()

const { PRIVATE_KEY, INFURA_API_KEY } = process.env

const networks = {
  hardhat: {},
  bsctestnet: {
    url: 'https://data-seed-prebsc-2-s1.binance.org:8545',
    accounts: [PRIVATE_KEY]
  },
  sepolia: {
    url: 'https://rpc-sepolia.rockx.com',
    accounts: [PRIVATE_KEY]
  },
  goerli: {
    url: `https://goerli.infura.io/v3/${INFURA_API_KEY}`,
    accounts: [PRIVATE_KEY]
  }
}

// This is a sample Hardhat task. To learn how to create your own go to
// https://hardhat.org/guides/create-task.html
task('accounts', 'Prints the list of accounts', async (taskArgs, hre) => {
  const accounts = await hre.ethers.getSigners()

  for (const account of accounts) {
    console.log(account.address)
  }
})

// You need to export an object to set up your config
// Go to https://hardhat.org/config/ to learn more

/**
 * @type import('hardhat/config').HardhatUserConfig
 */
module.exports = {
  solidity: '0.8.4',
  defaultNetwork: 'hardhat',
  networks
}
