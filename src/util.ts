import { BigNumber, ethers } from 'ethers';
import { parseAddress } from './addresses';

export function logBalances(balances: { [address: string]: BigNumber }) {
  const item = Object.keys(balances)
    .map(
      (key) =>
        `${parseAddress(key)}: ${ethers.utils
          .formatUnits(balances[key], 'ether')
          .toString()}`,
    )
    .join('\n');
  console.log(item);
}

export function toDigits(value: number, digits = 4) {
  return parseFloat(value.toFixed(digits));
}
