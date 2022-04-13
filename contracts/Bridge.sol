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

    event SupportedWrappedTokenAdded(address indexed token);
    event SupportedWrappedTokenRemoved(address indexed token);

    event SupportedTokenAdded(address indexed token);
    event SupportedTokenRemoved(address indexed token);

    uint256 public nonce = 1;

    address[] public validators;
    mapping(address => bool) public isValidator;
    mapping(address => bool) hasValidatorAlreadySigned;

    mapping(address => bool) public isSupportedWrappedToken;
    address[] public supportedWrappedTokens;
    mapping(address => bool) public isSupportedToken;
    address[] public supportedTokens;

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
        isSupportedToken[WETHAddress] = true;
    }

    function wrapAndTransferETH(string memory recipient)
        public
        payable
        nonReentrant
    {
        uint256 amount = msg.value;

        // normalize amount, we only want to handle 8 decimals maximum on Koinos
        uint256 normalizedAmount = normalizeAmount(amount, 18);

        require(
            normalizedAmount > 0,
            "normalizedAmount amount must be greater than 0"
        );

        // refund dust
        uint256 dust = amount - deNormalizeAmount(normalizedAmount, 18);
        if (dust > 0) {
            payable(msg.sender).transfer(dust);
        }

        // deposit into WETH
        WETH(WETHAddress).deposit{value: amount - dust}();

        emit LogTokensLocked(WETHAddress, recipient, normalizedAmount);
    }

    function transferTokens(
        address token,
        uint256 amount,
        string memory recipient
    ) public nonReentrant {
        require(
            isSupportedWrappedToken[token] || isSupportedToken[token],
            "token is not supported"
        );

        // query tokens decimals
        (, bytes memory queriedDecimals) = token.staticcall(
            abi.encodeWithSignature("decimals()")
        );
        uint8 decimals = abi.decode(queriedDecimals, (uint8));

        // don't deposit dust that can not be bridged due to the decimal shift
        amount = deNormalizeAmount(normalizeAmount(amount, decimals), decimals);

        if (isSupportedWrappedToken[token]) {
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
            normalizedAmount > 0,
            "normalizedAmount amount must be greater than 0"
        );

        emit LogTokensLocked(token, recipient, normalizedAmount);
    }

    function completeTransfer(
        bytes memory txId,
        uint256 operation,
        address token,
        address recipient,
        uint256 value,
        bytes[] memory signatures
    ) external nonReentrant {
        require(
            isSupportedWrappedToken[token] || isSupportedToken[token],
            "token is not supported"
        );

        bytes32 messageHash = getEthereumMessageHash(
            keccak256(abi.encodePacked(txId, operation, token, recipient, value, address(this)))
        );

        require(!isTransferCompleted[messageHash], "transfer already completed");
        isTransferCompleted[messageHash] = true;

        verifySignatures(signatures, messageHash);

        // query decimals
        (, bytes memory queriedDecimals) = token.staticcall(
            abi.encodeWithSignature("decimals()")
        );
        uint8 decimals = abi.decode(queriedDecimals, (uint8));

        // adjust decimals
        uint256 transferAmount = deNormalizeAmount(value, decimals);

        // transfer bridged amount to recipient
        if (isSupportedWrappedToken[token]) {
            // mint wrapped asset
            WrappedToken(token).mint(recipient, value);
        } else {
            SafeERC20.safeTransfer(IERC20(token), recipient, transferAmount);
        }
    }

    function addSupportedToken(bytes[] memory signatures, address token)
        external
    {
        bytes32 messageHash = getEthereumMessageHash(
            keccak256(abi.encodePacked(token, nonce, address(this)))
        );

        verifySignatures(signatures, messageHash);

        isSupportedToken[token] = true;
        supportedTokens.push(token);
        nonce += 1;

        emit SupportedTokenAdded(token);
        (token);
    }

    function removeSupportedToken(bytes[] memory signatures, address token)
        external
    {
        bytes32 messageHash = getEthereumMessageHash(
            keccak256(abi.encodePacked(token, nonce, address(this)))
        );

        verifySignatures(signatures, messageHash);

        isSupportedToken[token] = false;
        for (uint256 i = 0; i < supportedTokens.length; i++) {
            if (supportedTokens[i] == token) removeSupportedTokenByIndex(i);
        }
        nonce += 1;

        emit SupportedTokenRemoved(token);
    }

    function addSupportedWrappedToken(bytes[] memory signatures, address token)
        external
    {
        bytes32 messageHash = getEthereumMessageHash(
            keccak256(abi.encodePacked(token, nonce, address(this)))
        );

        verifySignatures(signatures, messageHash);

        isSupportedWrappedToken[token] = true;
        supportedWrappedTokens.push(token);
        nonce += 1;

        emit SupportedWrappedTokenAdded(token);
    }

    function removeWrappedToken(bytes[] memory signatures, address token)
        external
    {
        bytes32 messageHash = getEthereumMessageHash(
            keccak256(abi.encodePacked(token, nonce, address(this)))
        );

        verifySignatures(signatures, messageHash);

        isSupportedWrappedToken[token] = false;
        for (uint256 i = 0; i < supportedWrappedTokens.length; i++) {
            if (supportedWrappedTokens[i] == token) removeSupportedWrappedTokenByIndex(i);
        }
        nonce += 1;

        emit SupportedWrappedTokenRemoved(token);
    }

    function addValidator(bytes[] memory signatures, address newValidator)
        external
    {
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
        require(isValidator[validatorAddress], "Validator does not exist");

        bytes32 hash = getEthereumMessageHash(
            keccak256(abi.encodePacked(validatorAddress, nonce, address(this)))
        );

        verifySignatures(signatures, hash);

        isValidator[validatorAddress] = false;
        nonce += 1;

        for (uint256 i = 0; i < validators.length; i++) {
            if (validators[i] == validatorAddress) removeValidatorByIndex(i);
        }

        emit ValidatorRemoved(validatorAddress);
    }

    function verifySignatures(bytes[] memory signatures, bytes32 hash)
        internal
    {
        require(
            signatures.length >= (((validators.length * 10) / 3) * 2) / 10 + 1,
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

    function removeSupportedTokenByIndex(uint256 index) internal {
        require(index < supportedTokens.length, "index out of bound");

        for (uint256 i = index; i < supportedTokens.length - 1; i++) {
            supportedTokens[i] = supportedTokens[i + 1];
        }
        supportedTokens.pop();
    }

    function removeSupportedWrappedTokenByIndex(uint256 index) internal {
        require(index < supportedWrappedTokens.length, "index out of bound");

        for (uint256 i = index; i < supportedWrappedTokens.length - 1; i++) {
            supportedWrappedTokens[i] = supportedWrappedTokens[i + 1];
        }
        supportedWrappedTokens.pop();
    }

    function removeValidatorByIndex(uint256 index) internal {
        require(index < validators.length, "index out of bound");

        for (uint256 i = index; i < validators.length - 1; i++) {
            validators[i] = validators[i + 1];
        }
        validators.pop();
    }

    function getSupportedTokensLength() public view returns (uint256) {
        return supportedTokens.length;
    }

    function getSupportedWrappedTokensLength() public view returns (uint256) {
        return supportedWrappedTokens.length;
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
