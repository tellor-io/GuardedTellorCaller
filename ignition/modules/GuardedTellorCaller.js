// This setup uses Hardhat Ignition to manage smart contract deployments.
// Learn more about it at https://hardhat.org/ignition

const { buildModule } = require("@nomicfoundation/hardhat-ignition/modules");

const TELLOR_ADDRESS = "0x0000000000000000000000000000000000000000";
const GUARDIAN_ADDRESS = "0x0000000000000000000000000000000000000000";

module.exports = buildModule("GuardedTellorCallerModule", (m) => {
  const tellorAddress = m.getParameter("tellorAddress", TELLOR_ADDRESS);
  const guardianAddress = m.getParameter("guardianAddress", GUARDIAN_ADDRESS);

  const guardedTellorCaller = m.contract("GuardedTellorCaller", [tellorAddress, guardianAddress]);

  return { guardedTellorCaller };
});
