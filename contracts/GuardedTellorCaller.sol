// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

/**
 @author Tellor Inc.
 @title GuardedTellorCaller
 @dev This contract acts as a pausable proxy for Tellor oracle calls. It allows
 * designated guardians to pause oracle data retrieval in case of emergencies
 * or attacks. The contract maintains a list of guardian addresses who can
 * collectively manage the pause state and guardian membership. All oracle
 * calls are proxied through the fallback function when not paused.
*/
contract GuardedTellorCaller {
    // Storage
    mapping(address => bool) public guardians; // mapping of guardian addresses to their status
    bool public paused; // whether the contract is currently paused
    address public tellor; // address of the Tellor oracle contract
    uint256 public guardianCount; // total number of active guardians

    // Events
    event GuardianAdded(address indexed guardian);
    event GuardianRemoved(address indexed guardian);
    event Paused();
    event Unpaused();

    // Functions
    /**
     * @dev Initializes the GuardedTellorCaller with a Tellor oracle address and first guardian
     * @param _tellor address of the Tellor oracle contract to proxy calls to
     * @param _firstGuardian address of the initial guardian who can pause/unpause the contract
     */
    constructor(address _tellor, address _firstGuardian) {
        tellor = _tellor;
        guardians[_firstGuardian] = true;
        guardianCount++;
    }

    /**
     * @dev Allows an existing guardian to add a new guardian
     * @param _newGuardian address of the new guardian to add
     */
    function addGuardian(address _newGuardian) public {
        require(guardians[msg.sender], "Not a guardian");
        require(!guardians[_newGuardian], "Guardian already exists");
        guardians[_newGuardian] = true;
        guardianCount++;
        emit GuardianAdded(_newGuardian);
    }

    /**
     * @dev Allows an existing guardian to remove another guardian
     * @param _guardian address of the guardian to remove
     */
    function removeGuardian(address _guardian) public {
        require(guardians[msg.sender], "Not a guardian");
        require(guardians[_guardian], "Guardian does not exist");
        require(guardianCount > 1, "Cannot remove last guardian");
        guardians[_guardian] = false;
        guardianCount--;
        emit GuardianRemoved(_guardian);
    }

    /**
     * @dev Allows a guardian to pause the contract, preventing oracle calls
     */
    function pause() public {
        require(guardians[msg.sender], "Not a guardian");
        require(!paused, "Already paused");
        paused = true;
        emit Paused();
    }

    /**
     * @dev Allows a guardian to unpause the contract, resuming oracle calls
     */
    function unpause() public {
        require(guardians[msg.sender], "Not a guardian");
        require(paused, "Already unpaused");
        paused = false;
        emit Unpaused();
    }

    /**
     * @dev Fallback function that proxies calls to the Tellor oracle when not paused
     * @param _msgData the calldata to forward to the Tellor oracle
     * @return bytes the response data from the Tellor oracle call
     */
    fallback(bytes calldata _msgData) external payable returns (bytes memory) {
        require(!paused, "Tellor is paused");
        (bool success, bytes memory data) = tellor.call{value: msg.value}(_msgData);
        require(success, "Tellor call failed");
        // Return the data using inline assembly
        assembly {
            return(add(data, 0x20), mload(data))
        }
    }

    /**
     * @dev Receive function to handle plain ETH transfers to the contract
     */
    receive() external payable {}
}