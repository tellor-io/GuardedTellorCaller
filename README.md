# GuardedTellorCaller

GuardedTellorCaller is a contract which adds a _pause_ functionality for tellor oracle users. User contracts read tellor data through this guarded contract, but when this contract is paused, oracle reads revert. This contract gets deployed with two arguments: the tellor oracle address, and the first _guardian_. Any guardian can pause and unpause the contract at any time. Also, a guardian can add or remove other guardians. Under normal operations, this contract uses the evm `call` method (via a fallback function) to pass contract calls to the tellor oracle, and then passes any returned data to the caller.


## Install
```shell
git clone https://github.com/tellor-io/GuardedTellorCaller.git
cd GuardedTellorCaller
npm i
```

## Run Tests
```shell
npx hardhat test
```

