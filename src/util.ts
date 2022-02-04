import { BigNumber } from 'ethers';
import { parseAddress } from './addresses';

export function logBalances(balances: { [address: string]: BigNumber }) {
  const item = Object.keys(balances)
    .map((key) => `${parseAddress(key)}: ${balances[key].toString()}`)
    .join('\n');
  console.log(item);
}
