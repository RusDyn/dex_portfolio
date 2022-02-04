import { BigNumber } from 'ethers';

export type Balance = { [address: string]: BigNumber };

export interface Transfer {
  date: number;
  change: Balance;
}
