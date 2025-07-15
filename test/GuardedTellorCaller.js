const {
  time,
  loadFixture,
} = require("@nomicfoundation/hardhat-toolbox/network-helpers");
const { expect } = require("chai");
const { ethers } = require("hardhat");
const { abi, bytecode } = require("usingtellor/artifacts/contracts/TellorPlayground.sol/TellorPlayground.json");

describe("GuardedTellorCaller", function () {
  // Test data for ETH/USD price queries
  const abiCoder = new ethers.AbiCoder();
  const ETH_USD_QUERY_DATA_ARGS = abiCoder.encode(["string", "string"], ["eth", "usd"]);
  const ETH_USD_QUERY_DATA = abiCoder.encode(["string", "bytes"], ["SpotPrice", ETH_USD_QUERY_DATA_ARGS]);
  const ETH_USD_QUERY_ID = ethers.keccak256(ETH_USD_QUERY_DATA);

  // Fixture to deploy contracts for testing
  async function deployGuardedTellorCallerFixture() {
    const [deployer, guardian1, guardian2, nonGuardian] = await ethers.getSigners();
    
    // Deploy TellorPlayground oracle
    const TellorOracle = await ethers.getContractFactory(abi, bytecode);
    const tellorOracle = await TellorOracle.deploy();
    await tellorOracle.waitForDeployment();

    // Deploy GuardedTellorCaller with guardian1 as the first guardian
    const GuardedTellorCaller = await ethers.getContractFactory("GuardedTellorCaller");
    const guardedTellor = await GuardedTellorCaller.deploy(tellorOracle.target, guardian1.address);
    await guardedTellor.waitForDeployment();

    // Deploy SampleUsingTellor for integration testing
    const SampleUsingTellor = await ethers.getContractFactory("SampleUsingTellor");
    const sampleUsingTellor = await SampleUsingTellor.deploy(guardedTellor.target);
    await sampleUsingTellor.waitForDeployment();

    return {
      tellorOracle,
      guardedTellor,
      sampleUsingTellor,
      deployer,
      guardian1,
      guardian2,
      nonGuardian,
    };
  }

  describe("Deployment", function () {
    it("Should set the correct tellor oracle address", async function () {
      const { guardedTellor, tellorOracle } = await loadFixture(deployGuardedTellorCallerFixture);
      
      expect(await guardedTellor.tellor()).to.equal(tellorOracle.target);
    });

    it("Should set the first guardian correctly", async function () {
      const { guardedTellor, guardian1 } = await loadFixture(deployGuardedTellorCallerFixture);
      
      expect(await guardedTellor.guardians(guardian1.address)).to.equal(true);
      expect(await guardedTellor.guardianCount()).to.equal(1);
    });

    it("Should start in unpaused state", async function () {
      const { guardedTellor } = await loadFixture(deployGuardedTellorCallerFixture);
      
      expect(await guardedTellor.paused()).to.equal(false);
    });
  });

  describe("Guardian Management", function () {
    describe("addGuardian", function () {
      it("Should allow guardians to add new guardians", async function () {
        const { guardedTellor, guardian1, guardian2 } = await loadFixture(deployGuardedTellorCallerFixture);
        
        await expect(guardedTellor.connect(guardian1).addGuardian(guardian2.address))
          .to.emit(guardedTellor, "GuardianAdded")
          .withArgs(guardian2.address);
        
        expect(await guardedTellor.guardians(guardian2.address)).to.equal(true);
        expect(await guardedTellor.guardianCount()).to.equal(2);
      });

      it("Should revert when non-guardian tries to add guardian", async function () {
        const { guardedTellor, guardian2, nonGuardian } = await loadFixture(deployGuardedTellorCallerFixture);
        
        await expect(guardedTellor.connect(nonGuardian).addGuardian(guardian2.address))
          .to.be.revertedWith("Not a guardian");
      });

      it("Should revert when trying to add existing guardian", async function () {
        const { guardedTellor, guardian1, guardian2 } = await loadFixture(deployGuardedTellorCallerFixture);
        
        // Add guardian2 first
        await guardedTellor.connect(guardian1).addGuardian(guardian2.address);
        
        // Try to add guardian2 again
        await expect(guardedTellor.connect(guardian1).addGuardian(guardian2.address))
          .to.be.revertedWith("Guardian already exists");
      });
    });

    describe("removeGuardian", function () {
      it("Should allow guardians to remove other guardians", async function () {
        const { guardedTellor, guardian1, guardian2 } = await loadFixture(deployGuardedTellorCallerFixture);
        
        // Add guardian2 first
        await guardedTellor.connect(guardian1).addGuardian(guardian2.address);
        expect(await guardedTellor.guardianCount()).to.equal(2);
        
        // Remove guardian1
        await expect(guardedTellor.connect(guardian2).removeGuardian(guardian1.address))
          .to.emit(guardedTellor, "GuardianRemoved")
          .withArgs(guardian1.address);
        
        expect(await guardedTellor.guardians(guardian1.address)).to.equal(false);
        expect(await guardedTellor.guardianCount()).to.equal(1);
      });

      it("Should revert when non-guardian tries to remove guardian", async function () {
        const { guardedTellor, guardian1, nonGuardian } = await loadFixture(deployGuardedTellorCallerFixture);
        
        await expect(guardedTellor.connect(nonGuardian).removeGuardian(guardian1.address))
          .to.be.revertedWith("Not a guardian");
      });

      it("Should revert when trying to remove non-existent guardian", async function () {
        const { guardedTellor, guardian1, guardian2 } = await loadFixture(deployGuardedTellorCallerFixture);
        
        await expect(guardedTellor.connect(guardian1).removeGuardian(guardian2.address))
          .to.be.revertedWith("Guardian does not exist");
      });

      it("Should revert when trying to remove the last guardian", async function () {
        const { guardedTellor, guardian1 } = await loadFixture(deployGuardedTellorCallerFixture);
        
        await expect(guardedTellor.connect(guardian1).removeGuardian(guardian1.address))
          .to.be.revertedWith("Cannot remove last guardian");
      });
    });
  });

  describe("Pause/Unpause Functionality", function () {
    describe("pause", function () {
      it("Should allow guardians to pause the contract", async function () {
        const { guardedTellor, guardian1 } = await loadFixture(deployGuardedTellorCallerFixture);
        
        await expect(guardedTellor.connect(guardian1).pause())
          .to.emit(guardedTellor, "Paused");
        
        expect(await guardedTellor.paused()).to.equal(true);
      });

      it("Should revert when non-guardian tries to pause", async function () {
        const { guardedTellor, nonGuardian } = await loadFixture(deployGuardedTellorCallerFixture);
        
        await expect(guardedTellor.connect(nonGuardian).pause())
          .to.be.revertedWith("Not a guardian");
      });

      it("Should revert when trying to pause already paused contract", async function () {
        const { guardedTellor, guardian1 } = await loadFixture(deployGuardedTellorCallerFixture);
        
        // Pause first
        await guardedTellor.connect(guardian1).pause();
        
        // Try to pause again
        await expect(guardedTellor.connect(guardian1).pause())
          .to.be.revertedWith("Already paused");
      });
    });

    describe("unpause", function () {
      it("Should allow guardians to unpause the contract", async function () {
        const { guardedTellor, guardian1 } = await loadFixture(deployGuardedTellorCallerFixture);
        
        // Pause first
        await guardedTellor.connect(guardian1).pause();
        expect(await guardedTellor.paused()).to.equal(true);
        
        // Unpause
        await expect(guardedTellor.connect(guardian1).unpause())
          .to.emit(guardedTellor, "Unpaused");
        
        expect(await guardedTellor.paused()).to.equal(false);
      });

      it("Should revert when non-guardian tries to unpause", async function () {
        const { guardedTellor, guardian1, nonGuardian } = await loadFixture(deployGuardedTellorCallerFixture);
        
        // Pause first
        await guardedTellor.connect(guardian1).pause();
        
        await expect(guardedTellor.connect(nonGuardian).unpause())
          .to.be.revertedWith("Not a guardian");
      });

      it("Should revert when trying to unpause already unpaused contract", async function () {
        const { guardedTellor, guardian1 } = await loadFixture(deployGuardedTellorCallerFixture);
        
        await expect(guardedTellor.connect(guardian1).unpause())
          .to.be.revertedWith("Already unpaused");
      });
    });
  });

  describe("Oracle Proxy Functionality", function () {
    describe("Normal Operation (Unpaused)", function () {
      it("Should successfully proxy oracle calls when unpaused", async function () {
        const { tellorOracle, sampleUsingTellor } = await loadFixture(deployGuardedTellorCallerFixture);
        
        // Mock ETH/USD price value
        const mockValue = BigInt(2000e18);
        const mockValueBytes = abiCoder.encode(["uint256"], [mockValue]);
        
        // Submit value to TellorPlayground
        await tellorOracle.submitValue(ETH_USD_QUERY_ID, mockValueBytes, 0, ETH_USD_QUERY_DATA);
        
        // Advance time by 15 minutes to allow value retrieval
        await time.increase(901);
        
        // Should successfully read the price through GuardedTellorCaller
        await sampleUsingTellor.readEthPrice();
        const retrievedPrice = await sampleUsingTellor.ethPrice();
        
        expect(retrievedPrice).to.equal(mockValue);
      });

      it("Should handle oracle data validation correctly", async function () {
        const { tellorOracle, sampleUsingTellor } = await loadFixture(deployGuardedTellorCallerFixture);
        
        const mockValue1 = BigInt(2000e18);
        const mockValue2 = BigInt(3000e18);
        const mockValue3 = BigInt(4000e18);
        
        const mockValue1Bytes = abiCoder.encode(["uint256"], [mockValue1]);
        const mockValue2Bytes = abiCoder.encode(["uint256"], [mockValue2]);
        const mockValue3Bytes = abiCoder.encode(["uint256"], [mockValue3]);
        
        // Submit first value
        await tellorOracle.submitValue(ETH_USD_QUERY_ID, mockValue1Bytes, 0, ETH_USD_QUERY_DATA);
        const block1 = await ethers.provider.getBlock();
        
        // Submit second value
        await tellorOracle.submitValue(ETH_USD_QUERY_ID, mockValue2Bytes, 0, ETH_USD_QUERY_DATA);
        const block2 = await ethers.provider.getBlock();
        
        // Without waiting 15 minutes, should return 0
        await sampleUsingTellor.readEthPrice();
        let retrievedPrice = await sampleUsingTellor.ethPrice();
        expect(retrievedPrice).to.equal(0);
        
        // Advance time by 15 minutes
        await time.increase(901);
        
        // Should return the second value
        await sampleUsingTellor.readEthPrice();
        retrievedPrice = await sampleUsingTellor.ethPrice();
        expect(retrievedPrice).to.equal(mockValue2);
        
        // Dispute the second value
        await tellorOracle.beginDispute(ETH_USD_QUERY_ID, block2.timestamp);
        
        // Should still return the second value (disputes don't immediately invalidate)
        await sampleUsingTellor.readEthPrice();
        retrievedPrice = await sampleUsingTellor.ethPrice();
        expect(retrievedPrice).to.equal(mockValue2);
        
        // Submit third value
        await tellorOracle.submitValue(ETH_USD_QUERY_ID, mockValue3Bytes, 0, ETH_USD_QUERY_DATA);
        
        // Advance time again
        await time.increase(901);
        
        // Should return the third value
        await sampleUsingTellor.readEthPrice();
        retrievedPrice = await sampleUsingTellor.ethPrice();
        expect(retrievedPrice).to.equal(mockValue3);
      });
    });

    describe("Paused Operation", function () {
      it("Should revert oracle calls when paused", async function () {
        const { tellorOracle, guardedTellor, sampleUsingTellor, guardian1 } = await loadFixture(deployGuardedTellorCallerFixture);
        
        // Set up oracle data
        const mockValue = BigInt(2000e18);
        const mockValueBytes = abiCoder.encode(["uint256"], [mockValue]);
        await tellorOracle.submitValue(ETH_USD_QUERY_ID, mockValueBytes, 0, ETH_USD_QUERY_DATA);
        await time.increase(901);
        
        // Pause the contract
        await guardedTellor.connect(guardian1).pause();
        
        // Oracle calls should revert
        await expect(sampleUsingTellor.readEthPrice())
          .to.be.revertedWith("Tellor is paused");
      });

      it("Should resume oracle calls after unpause", async function () {
        const { tellorOracle, guardedTellor, sampleUsingTellor, guardian1 } = await loadFixture(deployGuardedTellorCallerFixture);
        
        // Set up oracle data
        const mockValue = BigInt(2000e18);
        const mockValueBytes = abiCoder.encode(["uint256"], [mockValue]);
        await tellorOracle.submitValue(ETH_USD_QUERY_ID, mockValueBytes, 0, ETH_USD_QUERY_DATA);
        await time.increase(901);
        
        // Pause the contract
        await guardedTellor.connect(guardian1).pause();
        
        // Verify calls are blocked
        await expect(sampleUsingTellor.readEthPrice())
          .to.be.revertedWith("Tellor is paused");
        
        // Unpause the contract
        await guardedTellor.connect(guardian1).unpause();
        
        // Oracle calls should work again
        await sampleUsingTellor.readEthPrice();
        const retrievedPrice = await sampleUsingTellor.ethPrice();
        expect(retrievedPrice).to.equal(mockValue);
      });
    });
  });

  describe("Fallback Function", function () {
    it("Should handle ETH transfers through receive function", async function () {
      const { guardedTellor, guardian1 } = await loadFixture(deployGuardedTellorCallerFixture);
      
      const sendValue = ethers.parseEther("1.0");
      
      // Send ETH to the contract
      await expect(guardian1.sendTransaction({
        to: guardedTellor.target,
        value: sendValue
      })).to.not.be.reverted;
      
      // Check contract balance
      const balance = await ethers.provider.getBalance(guardedTellor.target);
      expect(balance).to.equal(sendValue);
    });

    it("Should revert fallback calls when paused", async function () {
      const { guardedTellor, guardian1 } = await loadFixture(deployGuardedTellorCallerFixture);
      
      // Pause the contract
      await guardedTellor.connect(guardian1).pause();
      
      // Any call with data should revert
      await expect(guardian1.sendTransaction({
        to: guardedTellor.target,
        data: "0x12345678"
      })).to.be.revertedWith("Tellor is paused");
    });
  });

  describe("Multi-Guardian Scenarios", function () {
    it("Should work correctly with multiple guardians", async function () {
      const { guardedTellor, guardian1, guardian2, nonGuardian } = await loadFixture(deployGuardedTellorCallerFixture);
      
      // Add second guardian
      await guardedTellor.connect(guardian1).addGuardian(guardian2.address);
      expect(await guardedTellor.guardianCount()).to.equal(2);
      
      // Both guardians should be able to pause
      await guardedTellor.connect(guardian2).pause();
      expect(await guardedTellor.paused()).to.equal(true);
      
      // Both guardians should be able to unpause
      await guardedTellor.connect(guardian1).unpause();
      expect(await guardedTellor.paused()).to.equal(false);
      
      // Both guardians should be able to add new guardians
      await guardedTellor.connect(guardian2).addGuardian(nonGuardian.address);
      expect(await guardedTellor.guardians(nonGuardian.address)).to.equal(true);
      expect(await guardedTellor.guardianCount()).to.equal(3);
    });

    it("Should maintain guardian count correctly during add/remove operations", async function () {
      const { guardedTellor, guardian1, guardian2, nonGuardian } = await loadFixture(deployGuardedTellorCallerFixture);
      
      // Start with 1 guardian
      expect(await guardedTellor.guardianCount()).to.equal(1);
      
      // Add two more guardians
      await guardedTellor.connect(guardian1).addGuardian(guardian2.address);
      await guardedTellor.connect(guardian1).addGuardian(nonGuardian.address);
      expect(await guardedTellor.guardianCount()).to.equal(3);
      
      // Remove one guardian
      await guardedTellor.connect(guardian1).removeGuardian(guardian2.address);
      expect(await guardedTellor.guardianCount()).to.equal(2);
      
      // Remove another guardian
      await guardedTellor.connect(guardian1).removeGuardian(nonGuardian.address);
      expect(await guardedTellor.guardianCount()).to.equal(1);
      
      // Should not be able to remove the last guardian
      await expect(guardedTellor.connect(guardian1).removeGuardian(guardian1.address))
        .to.be.revertedWith("Cannot remove last guardian");
    });
  });
});
