import { BigNumber } from 'ethers';

export type Balance = { [address: string]: BigNumber };

export interface Transfer {
  date: number;
  change: Balance;
}

export interface HistoryData {
  balance: number;
  profit: number;
  dates: {
    last: number;
    first: number;
  };
}
export interface History {
  data: HistoryData;
  changes: number[];
  dates: number[];
  balances: number[];
}
