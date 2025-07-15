require("@nomicfoundation/hardhat-toolbox");

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    compilers: [
      {
        version: "0.8.3",
        settings: {
          optimizer: {
            enabled: true,
            runs: 300
          }
        }
      },
      {
        version: "0.8.19",
        settings: {
          optimizer: {
            enabled: true,
            runs: 300
          }
        }
      },
      {
        version: "0.8.28",
        settings: {
          optimizer: {
            enabled: true,
            runs: 300
          }
        }
      }
    ]
  },
};
