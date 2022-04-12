// contracts/GLDToken.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockFeeToken is ERC20 {
    constructor(uint256 initialSupply) ERC20("Mock Fee Token", "MFT") {
        _mint(msg.sender, initialSupply);
    }
    
    function transfer(address recipient, uint256 amount) public override returns (bool) {
        // 10% fee
        _transfer(msg.sender, recipient, amount * 9 / 10);
        return true;
    }
}