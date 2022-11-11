require('@nomiclabs/hardhat-waffle')
require('@nomiclabs/hardhat-web3')

require('dotenv').config()

const { API_URL_SEPOLIA, PRIVATE_KEY_SEPOLIA } = process.env

const networks = {
  hardhat: {}
}

if (API_URL_SEPOLIA && PRIVATE_KEY_SEPOLIA) {
  networks.sepolia = {
    url: API_URL_SEPOLIA,
    accounts: [`0x${PRIVATE_KEY_SEPOLIA}`]
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
