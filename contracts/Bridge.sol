// contracts/Bridge.sol
// SPDX-License-Identifier: Apache 2

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./WrappedToken.sol";

contract Bridge is ReentrancyGuard {
    event LogTokensLocked(
        address indexed token,
        string indexed recipient,
        uint256 amount
    );

    event ValidatorAdded(address indexed validator);
    event ValidatorRemoved(address indexed validator);

    event WrappedTokenAdded(address indexed wrappedToken);
    event WrappedTokenRemoved(address indexed wrappedToken);

    uint256 public nonce = 0;
    mapping(uint256 => bool) isNonceUsed;

    address[] public validators;
    mapping(address => bool) public isValidator;
    mapping(address => bool) hasValidatorAlreadySigned;

    mapping(address => bool) public isWrappedToken;
    mapping(bytes32 => bool) public isTransferCompleted;

    // Address of the official WETH contract
    address public WETHAddress;

    constructor(address[] memory initialValidators, address WETHAddress_) {
        require(initialValidators.length > 0, "Validators required");

        for (uint256 i = 0; i < initialValidators.length; i++) {
            address validator = initialValidators[i];

            require(validator != address(0), "Invalid validator");
            require(!isValidator[validator], "Validator not unique");

            isValidator[validator] = true;
            validators.push(validator);
        }

        WETHAddress = WETHAddress_;
    }

    function wrapAndTransferETH(string memory recipient) public payable nonReentrant {
        uint256 amount = msg.value;

        // normalize amount, we only want to handle 8 decimals maximum on Koinos
        uint256 normalizedAmount = normalizeAmount(amount, 18);

        require(
            normalizedAmount >= 0,
            "normalizedAmount amount must be greater than 0"
        );

        // refund dust
        uint256 dust = amount - deNormalizeAmount(normalizedAmount, 18);
        if (dust > 0) {
            payable(msg.sender).transfer(dust);
        }

        // deposit into WETH
        WETH(WETHAddress).deposit{value: amount - dust}();

        emit LogTokensLocked(
            WETHAddress,
            recipient,
            normalizedAmount
        );
    }

    function transferTokens(
        address token,
        uint256 amount,
        string memory recipient
    ) public nonReentrant {
        // query tokens decimals
        (, bytes memory queriedDecimals) = token.staticcall(
            abi.encodeWithSignature("decimals()")
        );
        uint8 decimals = abi.decode(queriedDecimals, (uint8));
        
        // don't deposit dust that can not be bridged due to the decimal shift
        amount = deNormalizeAmount(normalizeAmount(amount, decimals), decimals);

        if (isWrappedToken[token]) {
            SafeERC20.safeTransferFrom(
                IERC20(token),
                msg.sender,
                address(this),
                amount
            );
            WrappedToken(token).burn(address(this), amount);
        } else {
            // query own token balance before transfer
            (, bytes memory queriedBalanceBefore) = token.staticcall(
                abi.encodeWithSelector(IERC20.balanceOf.selector, address(this))
            );
            uint256 balanceBefore = abi.decode(queriedBalanceBefore, (uint256));

            // transfer tokens
            SafeERC20.safeTransferFrom(
                IERC20(token),
                msg.sender,
                address(this),
                amount
            );

            // query own token balance after transfer
            (, bytes memory queriedBalanceAfter) = token.staticcall(
                abi.encodeWithSelector(IERC20.balanceOf.selector, address(this))
            );
            uint256 balanceAfter = abi.decode(queriedBalanceAfter, (uint256));

            // correct amount for potential transfer fees
            amount = balanceAfter - balanceBefore;
        }

        // normalize amount, we only want to handle 8 decimals maximum on Koinos
        uint256 normalizedAmount = normalizeAmount(amount, decimals);

        require(
            normalizedAmount >= 0,
            "normalizedAmount amount must be greater than 0"
        );

        emit LogTokensLocked(
            token,
            recipient,
            normalizedAmount
        );
    }

    function completeTransfer(
        bytes memory txId,
        address token,
        address recipient,
        uint256 value,
        bytes[] memory signatures
    ) public nonReentrant {
        // hash is keccak256(transction id, token address, recipient address, value to transfer and address of bridge)
        bytes32 hash = getEthereumMessageHash(
            keccak256(
                abi.encodePacked(txId, token, recipient, value, address(this))
            )
        );

        require(!isTransferCompleted[hash], "transfer already completed");
        isTransferCompleted[hash] = true;

        verifySignatures(signatures, hash);

        IERC20 transferToken = IERC20(token);

        // query decimals
        (, bytes memory queriedDecimals) = address(transferToken).staticcall(
            abi.encodeWithSignature("decimals()")
        );
        uint8 decimals = abi.decode(queriedDecimals, (uint8));

        // adjust decimals
        uint256 transferAmount = deNormalizeAmount(value, decimals);

        // transfer bridged amount to recipient
        if (isWrappedToken[token]) {
            // mint wrapped asset
            WrappedToken(address(transferToken)).mint(recipient, value);
        } else {
            SafeERC20.safeTransfer(transferToken, recipient, transferAmount);
        }
    }

    function addWrappedToken(bytes[] memory signatures, address wrappedToken)
        external
    {
        require(!isNonceUsed[nonce], "Nonce already used");

        bytes32 messageHash = getEthereumMessageHash(
            keccak256(abi.encodePacked(wrappedToken, nonce, address(this)))
        );

        verifySignatures(signatures, messageHash);

        isWrappedToken[wrappedToken] = true;
        nonce += 1;

        emit WrappedTokenAdded(wrappedToken);
    }

    function removeWrappedToken(bytes[] memory signatures, address wrappedToken)
        external
    {
        require(!isNonceUsed[nonce], "Nonce already used");

        bytes32 messageHash = getEthereumMessageHash(
            keccak256(abi.encodePacked(wrappedToken, nonce, address(this)))
        );

        verifySignatures(signatures, messageHash);

        isWrappedToken[wrappedToken] = false;
        nonce += 1;

        emit WrappedTokenRemoved(wrappedToken);
    }

    function addValidator(bytes[] memory signatures, address newValidator)
        external
    {
        require(!isNonceUsed[nonce], "Nonce already used");
        require(!isValidator[newValidator], "Validator already exists");

        bytes32 messageHash = getEthereumMessageHash(
            keccak256(abi.encodePacked(newValidator, nonce, address(this)))
        );

        verifySignatures(signatures, messageHash);

        isValidator[newValidator] = true;
        validators.push(newValidator);
        nonce += 1;

        emit ValidatorAdded(newValidator);
    }

    function removeValidator(
        bytes[] memory signatures,
        address validatorAddress
    ) external {
        require(!isNonceUsed[nonce], "Nonce already used");
        require(isValidator[validatorAddress], "Validator does not exists");

        bytes32 hash = getEthereumMessageHash(
            keccak256(abi.encodePacked(validatorAddress, nonce, address(this)))
        );

        verifySignatures(signatures, hash);

        isValidator[validatorAddress] = false;
        nonce += 1;

        for (uint256 i = 0; i < validators.length; i++) {
            if (validators[i] == validatorAddress) removeByIndex(i);
        }

        emit ValidatorRemoved(validatorAddress);
    }

    function verifySignatures(bytes[] memory signatures, bytes32 hash)
        internal
    {
        require(
            (((validators.length * 10) / 3) * 2) / 10 + 1 > signatures.length,
            "quorum not met"
        );

        bool approved = true;

        address[] memory signers = new address[](signatures.length);

        for (uint256 i = 0; i < signatures.length; i++) {
            address signer = recoverSigner(hash, signatures[i]);
            if (isValidator[signer] && !hasValidatorAlreadySigned[signer]) {
                hasValidatorAlreadySigned[signer] = true;
                signers[i] = signer;
            } else {
                approved = false;
            }
        }

        require(approved, "invalid signatures");

        for (uint256 i = 0; i < signers.length; i++) {
            hasValidatorAlreadySigned[signers[i]] = false;
        }
    }

    function recoverSigner(bytes32 hash, bytes memory signature)
        internal
        pure
        returns (address)
    {
        bytes32 r;
        bytes32 s;
        uint8 v;

        if (signature.length != 65) {
            return (address(0));
        }

        assembly {
            r := mload(add(signature, 0x20))
            s := mload(add(signature, 0x40))
            v := byte(0, mload(add(signature, 0x60)))
        }

        if (v < 27) {
            v += 27;
        }

        if (v != 27 && v != 28) {
            return (address(0));
        } else {
            return ecrecover(hash, v, r, s);
        }
    }

    function getEthereumMessageHash(bytes32 hash)
        public
        pure
        returns (bytes32)
    {
        return
            keccak256(
                abi.encodePacked("\x19Ethereum Signed Message:\n32", hash)
            );
    }

    function normalizeAmount(uint256 amount, uint8 decimals)
        internal
        pure
        returns (uint256)
    {
        if (decimals > 8) {
            amount /= 10**(decimals - 8);
        }

        return amount;
    }

    function deNormalizeAmount(uint256 amount, uint8 decimals)
        internal
        pure
        returns (uint256)
    {
        if (decimals > 8) {
            amount *= 10**(decimals - 8);
        }

        return amount;
    }

    function removeByIndex(uint256 index) internal {
        require(index < validators.length, "index out of bound");

        for (uint256 i = index; i < validators.length - 1; i++) {
            validators[i] = validators[i + 1];
        }
        validators.pop();
    }

    function getValidatorsLength() public view returns (uint256) {
        return validators.length;
    }

    fallback() external payable {
        revert("please use wrapAndTransferETH to transfer ETH to Koinos");
    }

    receive() external payable {
        revert("please use wrapAndTransferETH to transfer ETH to Koinos");
    }
}

interface WETH is IERC20 {
    function deposit() external payable;

    function withdraw(uint256 amount) external;
}
